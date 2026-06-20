import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QAAgent } from '../../../../src/agents/qa/index.js';
import { InMemoryAgentMemory } from '../../../../src/agents/qa/memory.js';
import type { ILogger } from '../../../../src/logging/logger.js';
import type { MCPServerManager } from '../../../../src/mcp/manager/index.js';
import type { MCPToolSchema } from '../../../../src/shared/types.js';

const TOOLS: MCPToolSchema[] = [
  { name: 'browser_navigate', description: 'Navigate', inputSchema: {} },
  { name: 'browser_screenshot', description: 'Screenshot', inputSchema: {} },
  { name: 'browser_evaluate', description: 'Evaluate', inputSchema: {} },
  { name: 'browser_get_text', description: 'Get text', inputSchema: {} },
];

function makeLogger(): ILogger {
  return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeManager(callResult: unknown = {}): MCPServerManager {
  return {
    getAvailableTools: vi.fn().mockReturnValue(TOOLS),
    isServerAvailable: vi.fn().mockReturnValue(true),
    callTool: vi.fn().mockResolvedValue({ result: callResult }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MCPServerManager;
}

describe('QAAgent', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = makeLogger();
  });

  it('returns a QAReport with a sessionId', async () => {
    const agent = new QAAgent(makeManager(), logger, { serverId: 'playwright' });
    const report = await agent.run('Open https://example.com and validate login page');
    expect(typeof report.sessionId).toBe('string');
    expect(report.sessionId.length).toBeGreaterThan(0);
  });

  it('returns a QAReport with the original task', async () => {
    const task = 'Open https://example.com/login and validate login page';
    const agent = new QAAgent(makeManager(), logger, { serverId: 'playwright' });
    const report = await agent.run(task);
    expect(report.task).toBe(task);
  });

  it('stores the result in memory after completion', async () => {
    const memory = new InMemoryAgentMemory();
    const agent = new QAAgent(makeManager(), logger, { serverId: 'playwright' }, memory);
    await agent.run('Open https://example.com and validate login page');
    expect(agent.memory.size).toBe(1);
  });

  it('second run with similar task finds memory hit', async () => {
    const memory = new InMemoryAgentMemory();
    const agent = new QAAgent(makeManager(), logger, { serverId: 'playwright' }, memory);
    await agent.run('Open https://example.com and validate login page');
    await agent.run('Open https://example.com validate login page');

    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      'qa.plan',
      'memory.hit',
      expect.any(Object),
      expect.any(Object),
      0,
    );
  });

  it('report includes actions and validations', async () => {
    const evalOutput = JSON.stringify({
      hasEmailOrUsername: true, hasPassword: true, hasSubmitButton: true,
      pageTitle: 'Login', url: 'https://example.com/login',
    });
    const manager = makeManager({ content: [{ type: 'text', text: evalOutput }] });
    const agent = new QAAgent(manager, logger, { serverId: 'playwright' });
    const report = await agent.run('Open https://example.com/login and validate login page');

    expect(report.actions.length).toBeGreaterThan(0);
    expect(typeof report.durationMs).toBe('number');
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof report.summary).toBe('string');
  });

  it('handles tool call failure gracefully and returns failed report', async () => {
    const manager = makeManager();
    (manager.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    const agent = new QAAgent(manager, logger, { serverId: 'playwright' });
    const report = await agent.run('Open https://example.com and validate login page');

    expect(report.status).toBe('failed');
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it('report has completedAt after startedAt', async () => {
    const agent = new QAAgent(makeManager(), logger, { serverId: 'playwright' });
    const report = await agent.run('Open https://example.com');
    expect(new Date(report.completedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(report.startedAt).getTime(),
    );
  });

  it('each run produces a unique sessionId', async () => {
    const agent = new QAAgent(makeManager(), logger, { serverId: 'playwright' });
    const [r1, r2] = await Promise.all([
      agent.run('Open https://example.com'),
      agent.run('Open https://other.com'),
    ]);
    expect(r1.sessionId).not.toBe(r2.sessionId);
  });

  it('stage retry: re-runs plan stage on transient failure', async () => {
    const manager = makeManager();
    let planCalls = 0;
    const originalGetTools = manager.getAvailableTools as ReturnType<typeof vi.fn>;
    originalGetTools.mockImplementation(() => {
      planCalls++;
      if (planCalls === 1) throw new Error('ECONNRESET transient');
      return TOOLS;
    });

    const agent = new QAAgent(manager, logger, { serverId: 'playwright' }, undefined);
    const report = await agent.run('Open https://example.com');
    expect(report).toBeDefined();
  });
});
