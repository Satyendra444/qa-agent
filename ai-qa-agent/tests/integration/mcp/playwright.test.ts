/**
 * Integration test — requires a real Playwright MCP server.
 * Run with: npm run test:integration
 *
 * Prerequisites:
 *   npx @playwright/mcp@latest must be executable (i.e. @playwright/mcp installed)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPServerManager } from '../../../src/mcp/manager/index.js';
import { ConsoleLogger } from '../../../src/logging/logger.js';

const SESSION_ID = 'integration-test';

describe('Playwright MCP Server — integration', () => {
  let manager: MCPServerManager;

  beforeAll(async () => {
    manager = new MCPServerManager(
      [
        {
          id: 'playwright',
          transport: 'stdio',
          command: 'npx',
          args: ['@playwright/mcp@latest', '--headless'],
          connectTimeoutMs: 20_000,
        },
      ],
      new ConsoleLogger(),
    );
    await manager.connect();
  }, 30_000);

  afterAll(async () => {
    await manager.disconnect();
  });

  it('connects successfully to the Playwright MCP server', () => {
    expect(manager.isServerAvailable('playwright')).toBe(true);
  });

  it('discovers at least one tool', () => {
    const tools = manager.getAvailableTools('playwright');
    expect(tools.length).toBeGreaterThan(0);
  });

  it('discovers browser_navigate tool', () => {
    const tools = manager.getAvailableTools('playwright');
    const names = tools.map((t) => t.name);
    expect(names).toContain('browser_navigate');
  });

  it('discovers browser_screenshot tool', () => {
    const tools = manager.getAvailableTools('playwright');
    const names = tools.map((t) => t.name);
    expect(names).toContain('browser_screenshot');
  });

  it('all discovered tools have name, description, and inputSchema', () => {
    const tools = manager.getAvailableTools('playwright');
    for (const tool of tools) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.inputSchema).toBe('object');
    }
  });

  it('executes browser_navigate and returns a result', async () => {
    const { result } = await manager.callTool(
      'playwright',
      'browser_navigate',
      { url: 'https://example.com' },
      SESSION_ID,
    );
    expect(result).toBeDefined();
  }, 20_000);

  it('executes browser_screenshot after navigation', async () => {
    const { result } = await manager.callTool(
      'playwright',
      'browser_screenshot',
      {},
      SESSION_ID,
    );
    expect(result).toBeDefined();
  }, 20_000);

  it('callTool emits a log entry with correct shape', async () => {
    const logs: unknown[] = [];
    const capturingLogger = {
      log: (entry: unknown) => logs.push(entry),
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };

    const m = new MCPServerManager(
      [
        {
          id: 'playwright',
          transport: 'stdio',
          command: 'npx',
          args: ['@playwright/mcp@latest', '--headless'],
          connectTimeoutMs: 20_000,
        },
      ],
      capturingLogger,
    );
    await m.connect();
    await m.callTool('playwright', 'browser_navigate', { url: 'https://example.com' }, SESSION_ID);
    await m.disconnect();

    const toolLog = (logs as Array<Record<string, unknown>>).find(
      (e) => e['tool'] === 'playwright.browser_navigate',
    );
    expect(toolLog).toBeDefined();
    expect(toolLog?.['status']).toBe('success');
    expect(toolLog?.['sessionId']).toBe(SESSION_ID);
    expect(typeof toolLog?.['latency']).toBe('number');
    expect((toolLog?.['latency'] as number)).toBeGreaterThanOrEqual(0);
  }, 30_000);
});
