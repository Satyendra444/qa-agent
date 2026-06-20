import { describe, it, expect, vi } from 'vitest';
import { TestCaseAgent } from '../../../src/agents/testcase/index.js';
import type { ILogger } from '../../../src/logging/logger.js';
import type { MCPServerManager } from '../../../src/mcp/manager/index.js';
import type { Scenario } from '../../../src/shared/types.js';

function makeLogger(): ILogger {
  return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeManager(): MCPServerManager {
  return {
    isServerAvailable: vi.fn().mockReturnValue(false),
    callTool: vi.fn(),
    getAvailableTools: vi.fn().mockReturnValue([]),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MCPServerManager;
}

const VALID_SCENARIOS: Scenario[] = [
  {
    id: 's1',
    title: 'Login page validation',
    description: 'Verify the login form is accessible and has required fields',
    acceptanceCriteria: ['Email field is visible', 'Password field is visible', 'Submit button is visible'],
    edgeCases: ['Empty fields', 'Invalid email format'],
  },
];

describe('TestCaseAgent', () => {
  it('returns INVALID_INPUT for empty array', async () => {
    const agent = new TestCaseAgent(makeManager(), makeLogger(), 's');
    const result = await agent.generate([]);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toBe('INVALID_INPUT');
  });

  it('returns INVALID_INPUT for malformed scenarios', async () => {
    const agent = new TestCaseAgent(makeManager(), makeLogger(), 's');
    const result = await agent.generate([{ id: '' } as unknown as Scenario]);
    expect('error' in result).toBe(true);
  });

  it('generates exactly 3 test cases per scenario (positive, negative, edge)', async () => {
    const agent = new TestCaseAgent(makeManager(), makeLogger(), 's');
    const result = await agent.generate(VALID_SCENARIOS);
    if ('error' in result) throw new Error('Expected success');
    expect(result.testCases).toHaveLength(3);
  });

  it('generates at least 3N test cases for N scenarios', async () => {
    const agent = new TestCaseAgent(makeManager(), makeLogger(), 's');
    const twoScenarios = [...VALID_SCENARIOS, { ...VALID_SCENARIOS[0]!, id: 's2', title: 'Registration' }];
    const result = await agent.generate(twoScenarios);
    if ('error' in result) throw new Error('Expected success');
    expect(result.testCases.length).toBeGreaterThanOrEqual(6);
  });

  it('each scenario has one positive, one negative, and one edge test case', async () => {
    const agent = new TestCaseAgent(makeManager(), makeLogger(), 's');
    const result = await agent.generate(VALID_SCENARIOS);
    if ('error' in result) throw new Error('Expected success');
    const types = result.testCases.map((tc) => tc.type);
    expect(types).toContain('positive');
    expect(types).toContain('negative');
    expect(types).toContain('edge');
  });

  it('all test cases have required fields', async () => {
    const agent = new TestCaseAgent(makeManager(), makeLogger(), 's');
    const result = await agent.generate(VALID_SCENARIOS);
    if ('error' in result) throw new Error('Expected success');
    for (const tc of result.testCases) {
      expect(typeof tc.id).toBe('string');
      expect(tc.id.length).toBeGreaterThan(0);
      expect(typeof tc.title).toBe('string');
      expect(['positive', 'negative', 'edge']).toContain(tc.type);
      expect(Array.isArray(tc.preconditions)).toBe(true);
      expect(Array.isArray(tc.steps)).toBe(true);
      expect(tc.steps.length).toBeGreaterThan(0);
      expect(typeof tc.expectedResult).toBe('string');
      expect(tc.expectedResult.length).toBeGreaterThan(0);
    }
  });

  it('test case IDs are unique within the session', async () => {
    const agent = new TestCaseAgent(makeManager(), makeLogger(), 's');
    const twoScenarios = [
      VALID_SCENARIOS[0]!,
      { ...VALID_SCENARIOS[0]!, id: 's2', title: 'Registration page' },
    ];
    const result = await agent.generate(twoScenarios);
    if ('error' in result) throw new Error('Expected success');
    const ids = result.testCases.map((tc) => tc.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
