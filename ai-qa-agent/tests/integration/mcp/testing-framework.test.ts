import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPServerManager } from '../../../src/mcp/manager/index.js';
import { MCPTestingFramework } from '../../../src/mcp/testing/index.js';
import { ConsoleLogger } from '../../../src/logging/logger.js';

const SERVER_ID = 'playwright';
const SESSION_ID = 'integration-testing-framework';

describe('MCP Testing Framework — integration', () => {
  let manager: MCPServerManager;
  let framework: MCPTestingFramework;

  beforeAll(async () => {
    manager = new MCPServerManager(
      [
        {
          id: SERVER_ID,
          transport: 'stdio',
          command: 'npx',
          args: ['@playwright/mcp@latest', '--headless'],
          connectTimeoutMs: 20_000,
        },
      ],
      new ConsoleLogger(),
    );

    await manager.connect();
    framework = new MCPTestingFramework(manager, { concurrencyLevel: 2, timeoutMs: 30_000 }, new ConsoleLogger());
  }, 60_000);

  afterAll(async () => {
    await manager.disconnect();
  });

  it('runs the full MCP test suite and produces a report', async () => {
    const report = await framework.runAllTests(SERVER_ID);

    expect(report.serverId).toBe(SERVER_ID);
    expect(report.toolCount).toBeGreaterThan(0);
    expect(report.contractTests).toHaveProperty('passed');
    expect(report.functional.discovered).toBe(true);
    expect(report.performance.averageLatencyMs).toBeGreaterThanOrEqual(0);
    expect(report.securityResults).toHaveProperty('sqlInjection');
    expect(Array.isArray(report.schemaViolations)).toBe(true);
    expect(report.negativeTests.invalidParams).toBeInstanceOf(Array);
    expect(typeof report.generatedAt).toBe('string');
  }, 120_000);
});
