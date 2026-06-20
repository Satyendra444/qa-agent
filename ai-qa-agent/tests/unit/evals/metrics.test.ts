import { describe, it, expect } from 'vitest';
import {
  computeTaskSuccessRate, computeToolAccuracy, computeAverageLatency,
  computeTokenUsage, computeFailureRate, computeCostPerExecution,
} from '../../../src/evals/metrics.js';
import type { LogEntry } from '../../../src/shared/types.js';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    sessionId: 'sess-1',
    agent: 'test.agent',
    tool: 'some.tool',
    input: {},
    output: {},
    latency: 100,
    status: 'success',
    tokensUsed: 10,
    errors: [],
    ...overrides,
  };
}

describe('computeTaskSuccessRate', () => {
  it('returns 0 for empty log', () => expect(computeTaskSuccessRate([])).toBe(0));

  it('returns 1.0 when all non-mcp entries are success', () => {
    const log = [makeEntry({ agent: 'req.agent', status: 'success' })];
    expect(computeTaskSuccessRate(log)).toBe(1.0);
  });

  it('excludes mcp.manager entries from calculation', () => {
    const log = [
      makeEntry({ agent: 'mcp.manager', status: 'error' }),
      makeEntry({ agent: 'req.agent', status: 'success' }),
    ];
    expect(computeTaskSuccessRate(log)).toBe(1.0);
  });

  it('computes correct ratio', () => {
    const log = [
      makeEntry({ agent: 'a', status: 'success' }),
      makeEntry({ agent: 'b', status: 'success' }),
      makeEntry({ agent: 'c', status: 'error' }),
    ];
    expect(computeTaskSuccessRate(log)).toBeCloseTo(2 / 3, 4);
  });
});

describe('computeToolAccuracy', () => {
  it('returns null when no reference decisions', () => {
    expect(computeToolAccuracy([makeEntry()], undefined)).toBeNull();
    expect(computeToolAccuracy([makeEntry()], [])).toBeNull();
  });

  it('returns null when no mcp.manager entries in log', () => {
    const refs = [{ toolCall: 'playwright.navigate', optimalTool: 'playwright.navigate' }];
    expect(computeToolAccuracy([makeEntry({ agent: 'other' })], refs)).toBeNull();
  });

  it('returns 1.0 when all tool calls match reference', () => {
    const log = [makeEntry({ agent: 'mcp.manager', tool: 'playwright.navigate' })];
    const refs = [{ toolCall: 'playwright.navigate', optimalTool: 'playwright.navigate' }];
    expect(computeToolAccuracy(log, refs)).toBe(1.0);
  });

  it('returns 0 when no tool calls match reference', () => {
    const log = [makeEntry({ agent: 'mcp.manager', tool: 'playwright.navigate' })];
    const refs = [{ toolCall: 'playwright.navigate', optimalTool: 'playwright.click' }];
    expect(computeToolAccuracy(log, refs)).toBe(0);
  });
});

describe('computeAverageLatency', () => {
  it('returns 0 for empty log', () => expect(computeAverageLatency([])).toBe(0));

  it('computes mean correctly', () => {
    const log = [makeEntry({ latency: 100 }), makeEntry({ latency: 200 }), makeEntry({ latency: 300 })];
    expect(computeAverageLatency(log)).toBeCloseTo(200, 4);
  });
});

describe('computeTokenUsage', () => {
  it('returns 0 for empty log', () => expect(computeTokenUsage([])).toBe(0));

  it('sums all tokensUsed', () => {
    const log = [makeEntry({ tokensUsed: 10 }), makeEntry({ tokensUsed: 25 }), makeEntry({ tokensUsed: 5 })];
    expect(computeTokenUsage(log)).toBe(40);
  });
});

describe('computeFailureRate', () => {
  it('returns 0 for empty log', () => expect(computeFailureRate([])).toBe(0));

  it('returns 0 when no mcp.manager entries', () => {
    expect(computeFailureRate([makeEntry({ agent: 'other', status: 'error' })])).toBe(0);
  });

  it('computes failure ratio among tool calls', () => {
    const log = [
      makeEntry({ agent: 'mcp.manager', status: 'success' }),
      makeEntry({ agent: 'mcp.manager', status: 'error' }),
      makeEntry({ agent: 'mcp.manager', status: 'error' }),
    ];
    expect(computeFailureRate(log)).toBeCloseTo(2 / 3, 4);
  });
});

describe('computeCostPerExecution', () => {
  it('returns tokenUsage * costPerToken', () => {
    expect(computeCostPerExecution(1000, 0.000001)).toBeCloseTo(0.001, 6);
  });

  it('returns 0 when tokenUsage is 0', () => {
    expect(computeCostPerExecution(0, 0.000001)).toBe(0);
  });
});
