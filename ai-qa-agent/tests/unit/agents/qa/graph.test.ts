import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGraph } from '../../../../src/agents/qa/graph.js';
import { InMemoryAgentMemory } from '../../../../src/agents/qa/memory.js';
import type { QAAgentState } from '../../../../src/agents/qa/types.js';
import type { ILogger } from '../../../../src/logging/logger.js';
import type { MCPServerManager } from '../../../../src/mcp/manager/index.js';
import type { MCPToolSchema } from '../../../../src/shared/types.js';

function makeLogger(): ILogger {
  return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeState(overrides: Partial<QAAgentState> = {}): QAAgentState {
  return {
    sessionId: 'test-session',
    task: 'Open https://example.com/login and validate login page',
    stage: 'plan',
    plannedActions: [],
    executedActions: [],
    validations: [],
    retryCount: {},
    errors: [],
    startedAt: new Date().toISOString(),
    report: null,
    ...overrides,
  };
}

function makeManager(tools: MCPToolSchema[] = [], callResult: unknown = { content: [{ type: 'text', text: 'login password email submit' }] }): MCPServerManager {
  return {
    getAvailableTools: vi.fn().mockReturnValue(tools),
    isServerAvailable: vi.fn().mockReturnValue(true),
    callTool: vi.fn().mockResolvedValue({ result: callResult }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MCPServerManager;
}

const TOOLS: MCPToolSchema[] = [
  { name: 'browser_navigate', description: 'Navigate', inputSchema: {} },
  { name: 'browser_screenshot', description: 'Screenshot', inputSchema: {} },
  { name: 'browser_evaluate', description: 'Evaluate', inputSchema: {} },
  { name: 'browser_get_text', description: 'Get text', inputSchema: {} },
];

describe('buildGraph — plan node', () => {
  it('produces plannedActions from task', async () => {
    const manager = makeManager(TOOLS);
    const graph = buildGraph(manager, new InMemoryAgentMemory(), makeLogger(), 'playwright');
    const state = makeState();
    const next = await graph.plan(state);
    expect(next.plannedActions.length).toBeGreaterThan(0);
    expect(next.stage).toBe('execute');
  });

  it('logs a memory hit when similar task exists in memory', async () => {
    const memory = new InMemoryAgentMemory();
    const logger = makeLogger();
    const report = {
      sessionId: 's0', task: 'Open example.com validate login page', status: 'passed' as const,
      startedAt: '', completedAt: '', durationMs: 0, actions: [], validations: [], summary: '', errors: [],
    };
    memory.store(InMemoryAgentMemory.makeEntry('s0', 'Open example.com validate login page', [], report));

    const manager = makeManager(TOOLS);
    const graph = buildGraph(manager, memory, logger, 'playwright');
    await graph.plan(makeState({ task: 'Open example.com and validate login page' }));

    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      'qa.plan',
      'memory.hit',
      expect.any(Object),
      expect.any(Object),
      0,
    );
  });
});

describe('buildGraph — execute node', () => {
  it('populates executedActions after execute', async () => {
    const manager = makeManager(TOOLS);
    const graph = buildGraph(manager, new InMemoryAgentMemory(), makeLogger(), 'playwright');

    const state = makeState({
      stage: 'execute',
      plannedActions: [
        { id: 'a1', toolName: 'browser_navigate', serverId: 'playwright', input: { url: 'https://example.com' }, description: 'Navigate', retries: 0 },
      ],
    });

    const next = await graph.execute(state);
    expect(next.executedActions).toHaveLength(1);
    expect(next.executedActions[0]?.status).toBe('success');
    expect(next.stage).toBe('validate');
  });

  it('records failure without throwing when tool call fails', async () => {
    const manager = makeManager(TOOLS);
    (manager.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));

    const graph = buildGraph(manager, new InMemoryAgentMemory(), makeLogger(), 'playwright');
    const state = makeState({
      stage: 'execute',
      plannedActions: [
        { id: 'a1', toolName: 'browser_navigate', serverId: 'playwright', input: { url: 'https://example.com' }, description: 'Navigate', retries: 0 },
      ],
    });

    const next = await graph.execute(state);
    expect(next.executedActions[0]?.status).toBe('failure');
    expect(next.errors).toHaveLength(1);
  });

  it('records timeout status for timeout errors', async () => {
    const manager = makeManager(TOOLS);
    (manager.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Tool call timeout after 30000ms'));

    const graph = buildGraph(manager, new InMemoryAgentMemory(), makeLogger(), 'playwright');
    const state = makeState({
      stage: 'execute',
      plannedActions: [
        { id: 'a1', toolName: 'browser_navigate', serverId: 'playwright', input: {}, description: 'Nav', retries: 0 },
      ],
    });

    const next = await graph.execute(state);
    expect(next.executedActions[0]?.status).toBe('timeout');
  });
});

describe('buildGraph — validate node', () => {
  it('runs structural validation from evaluate result', async () => {
    const evalOutput = JSON.stringify({
      hasEmailOrUsername: true,
      hasPassword: true,
      hasSubmitButton: true,
      pageTitle: 'Login',
      url: 'https://example.com/login',
    });

    const graph = buildGraph(makeManager(), new InMemoryAgentMemory(), makeLogger(), 'playwright');
    const state = makeState({
      stage: 'validate',
      executedActions: [
        {
          actionId: 'a1',
          toolName: 'browser_evaluate',
          input: {},
          output: { content: [{ type: 'text', text: evalOutput }] },
          status: 'success',
          latencyMs: 50,
          attempt: 1,
        },
      ],
    });

    const next = await graph.validate(state);
    expect(next.validations.length).toBeGreaterThan(0);
    expect(next.stage).toBe('report');
  });
});

describe('buildGraph — report node', () => {
  it('produces a QAReport with correct status', async () => {
    const graph = buildGraph(makeManager(), new InMemoryAgentMemory(), makeLogger(), 'playwright');
    const state = makeState({
      stage: 'report',
      executedActions: [
        {
          actionId: 'a1', toolName: 'browser_navigate', input: {}, output: {},
          status: 'success', latencyMs: 100, attempt: 1,
        },
      ],
      validations: [
        { name: 'Has password', passed: true, actual: 'password', expected: 'password' },
      ],
      errors: [],
    });

    const next = await graph.report(state);
    expect(next.report).not.toBeNull();
    expect(next.report?.status).toBe('passed');
    expect(next.report?.sessionId).toBe('test-session');
    expect(typeof next.report?.durationMs).toBe('number');
    expect(next.stage).toBe('completed');
  });

  it('sets status to "failed" when all actions failed', async () => {
    const graph = buildGraph(makeManager(), new InMemoryAgentMemory(), makeLogger(), 'playwright');
    const state = makeState({
      stage: 'report',
      executedActions: [
        {
          actionId: 'a1', toolName: 'browser_navigate', input: {}, output: null,
          status: 'failure', latencyMs: 0, attempt: 1, error: 'connection refused',
        },
      ],
      validations: [],
      errors: ['Action a1 failed'],
    });

    const next = await graph.report(state);
    expect(next.report?.status).toBe('failed');
  });

  it('sets status to "partial" when some validations fail', async () => {
    const graph = buildGraph(makeManager(), new InMemoryAgentMemory(), makeLogger(), 'playwright');
    const state = makeState({
      stage: 'report',
      executedActions: [
        { actionId: 'a1', toolName: 'browser_navigate', input: {}, output: {}, status: 'success', latencyMs: 50, attempt: 1 },
      ],
      validations: [
        { name: 'Has password', passed: true, actual: 'password', expected: 'password' },
        { name: 'Has captcha', passed: false, actual: '(not found)', expected: 'captcha', error: 'not found' },
      ],
      errors: [],
    });

    const next = await graph.report(state);
    expect(next.report?.status).toBe('partial');
  });
});
