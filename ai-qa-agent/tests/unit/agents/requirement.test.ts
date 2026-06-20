import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequirementAgent } from '../../../src/agents/requirement/index.js';
import type { ILogger } from '../../../src/logging/logger.js';
import type { MCPServerManager } from '../../../src/mcp/manager/index.js';

function makeLogger(): ILogger {
  return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeManager(available = false): MCPServerManager {
  return {
    isServerAvailable: vi.fn().mockReturnValue(available),
    callTool: vi.fn().mockResolvedValue({ result: {} }),
    getAvailableTools: vi.fn().mockReturnValue([]),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MCPServerManager;
}

describe('RequirementAgent — input validation', () => {
  it('rejects input with fewer than 10 words', async () => {
    const agent = new RequirementAgent(makeManager(), makeLogger(), 'sess-1');
    const result = await agent.analyze('Open login page');
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toBe('INVALID_INPUT');
  });

  it('rejects input with no verb-object pair', async () => {
    const agent = new RequirementAgent(makeManager(), makeLogger(), 'sess-1');
    const result = await agent.analyze('the user and the system and the application');
    expect('error' in result).toBe(true);
  });

  it('accepts valid requirement (≥10 words with verb)', async () => {
    const agent = new RequirementAgent(makeManager(), makeLogger(), 'sess-1');
    const result = await agent.analyze(
      'Open the website and validate the login page form fields',
    );
    expect('error' in result).toBe(false);
  });
});

describe('RequirementAgent — heuristic extraction (no LLM)', () => {
  let agent: RequirementAgent;

  beforeEach(() => {
    agent = new RequirementAgent(makeManager(), makeLogger(), 'sess-1');
  });

  it('returns scenarios array', async () => {
    const result = await agent.analyze(
      'Open the website and validate the login page form fields and credentials',
    );
    if ('error' in result) throw new Error('Expected success');
    expect(Array.isArray(result.scenarios)).toBe(true);
    expect(result.scenarios.length).toBeGreaterThan(0);
  });

  it('each scenario has required fields', async () => {
    const result = await agent.analyze(
      'Navigate to the login page and verify that email and password fields are visible',
    );
    if ('error' in result) throw new Error('Expected success');
    for (const s of result.scenarios) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.title).toBe('string');
      expect(Array.isArray(s.acceptanceCriteria)).toBe(true);
      expect(Array.isArray(s.edgeCases)).toBe(true);
    }
  });
});

describe('RequirementAgent — LLM path', () => {
  it('returns LLM_FAILURE when LLM returns non-JSON', async () => {
    const llmClient = { chat: vi.fn().mockResolvedValue({ content: 'not json at all', tokensUsed: 5 }) };
    const agent = new RequirementAgent(makeManager(), makeLogger(), 'sess-1', llmClient);
    const result = await agent.analyze(
      'Open the website and validate the login page form fields',
    );
    expect('error' in result && result.error === 'LLM_FAILURE').toBe(true);
  });

  it('returns extractionIncomplete when LLM returns valid JSON but empty scenarios', async () => {
    const llmClient = {
      chat: vi.fn().mockResolvedValue({
        content: '{"scenarios":[]}',
        tokensUsed: 10,
      }),
    };
    const agent = new RequirementAgent(makeManager(), makeLogger(), 'sess-1', llmClient);
    const result = await agent.analyze(
      'Open the website and validate the login page form fields',
    );
    if ('error' in result) throw new Error(`Unexpected error: ${result.reason}`);
    expect(result.extractionIncomplete).toBe(true);
  });

  it('returns scenarios when LLM returns valid JSON', async () => {
    const scenarios = [
      {
        id: 's1', title: 'Login page', description: 'check login',
        acceptanceCriteria: ['has email', 'has password'], edgeCases: [],
      },
    ];
    const llmClient = {
      chat: vi.fn().mockResolvedValue({ content: JSON.stringify({ scenarios }), tokensUsed: 50 }),
    };
    const agent = new RequirementAgent(makeManager(), makeLogger(), 'sess-1', llmClient);
    const result = await agent.analyze(
      'Open the website and validate the login page form fields',
    );
    if ('error' in result) throw new Error('Expected success');
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]?.id).toBe('s1');
  });
});
