import { describe, it, expect, vi } from 'vitest';
import { ContractValidator } from '../../../src/mcp/testing/contract.js';
import { ConcurrencyTester, MIN_CONCURRENCY, MAX_CONCURRENCY } from '../../../src/mcp/testing/concurrency.js';
import { MCPTestingFramework } from '../../../src/mcp/testing/index.js';
import type { MCPToolSchema } from '../../../src/shared/types.js';
import type { MCPServerManager } from '../../../src/mcp/manager/index.js';
import type { ILogger } from '../../../src/logging/logger.js';

function makeLogger(): ILogger {
  return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeManager(tools: MCPToolSchema[] = []): MCPServerManager {
  return {
    getAvailableTools: vi.fn().mockReturnValue(tools),
    isServerAvailable: vi.fn().mockReturnValue(true),
    callTool: vi.fn().mockResolvedValue({ result: { content: [{ type: 'text', text: 'ok' }] } }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MCPServerManager;
}

const VALID_TOOL: MCPToolSchema = {
  name: 'browser_navigate',
  description: 'Navigate to URL',
  inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
};

const INVALID_TOOL: MCPToolSchema = {
  name: 'bad_tool',
  description: 'Bad schema',
  inputSchema: { type: 'invalid-type-not-in-json-schema' },
};

describe('ContractValidator', () => {
  const validator = new ContractValidator();

  it('returns passed=1 for a well-formed JSON Schema tool', () => {
    const result = validator.validate([VALID_TOOL]);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.failures).toHaveLength(0);
  });

  it('returns failed=1 for an invalid JSON Schema tool', () => {
    const result = validator.validate([INVALID_TOOL]);
    expect(result.failed).toBe(1);
    expect(result.failures[0]?.toolName).toBe('bad_tool');
  });

  it('handles empty tool list', () => {
    const result = validator.validate([]);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('reports correct counts for mixed valid/invalid tools', () => {
    const result = validator.validate([VALID_TOOL, INVALID_TOOL]);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe('ConcurrencyTester', () => {
  it('throws for concurrencyLevel below MIN', async () => {
    const tester = new ConcurrencyTester(makeManager(), 1000);
    await expect(
      tester.run('playwright', 'browser_navigate', {}, MIN_CONCURRENCY - 1),
    ).rejects.toThrow();
  });

  it('throws for concurrencyLevel above MAX', async () => {
    const tester = new ConcurrencyTester(makeManager(), 1000);
    await expect(
      tester.run('playwright', 'browser_navigate', {}, MAX_CONCURRENCY + 1),
    ).rejects.toThrow();
  });

  it('runs N parallel calls and returns a ConcurrencyResult', async () => {
    const manager = makeManager([VALID_TOOL]);
    const tester = new ConcurrencyTester(manager, 5000);
    const result = await tester.run('playwright', 'browser_navigate', {}, 3);

    expect(result.concurrencyLevel).toBe(3);
    expect(result.successful + result.timedOut + result.failed).toBe(3);
    expect(typeof result.durationMs).toBe('number');
  });

  it('records timeout when call exceeds timeoutMs', async () => {
    const manager = makeManager([VALID_TOOL]);
    (manager.callTool as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 200)),
    );
    const tester = new ConcurrencyTester(manager, 50); // 50ms timeout
    const result = await tester.run('playwright', 'browser_navigate', {}, 2);
    expect(result.timedOut).toBeGreaterThan(0);
  });
});

describe('MCPTestingFramework', () => {
  it('throws when concurrencyLevel is out of range', () => {
    expect(() => new MCPTestingFramework(
      makeManager(), { concurrencyLevel: 0, timeoutMs: 1000 }, makeLogger(),
    )).toThrow();

    expect(() => new MCPTestingFramework(
      makeManager(), { concurrencyLevel: 51, timeoutMs: 1000 }, makeLogger(),
    )).toThrow();
  });

  it('runContractTests returns a report with all required fields', async () => {
    const manager = makeManager([VALID_TOOL]);
    const framework = new MCPTestingFramework(
      manager, { concurrencyLevel: 1, timeoutMs: 5000 }, makeLogger(),
    );
    const report = await framework.runContractTests('playwright');

    expect(report.serverId).toBe('playwright');
    expect(typeof report.toolCount).toBe('number');
    expect('passed' in report.contractTests).toBe(true);
    expect('failed' in report.contractTests).toBe(true);
    expect(Array.isArray(report.schemaViolations)).toBe(true);
    expect(Array.isArray(report.errorHandlingGaps)).toBe(true);
    expect(typeof report.concurrencyResults.concurrencyLevel).toBe('number');
    expect(typeof report.securityResults.sqlInjection).toBe('object');
  });
});
