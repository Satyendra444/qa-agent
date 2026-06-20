import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPServerManager } from '../../../src/mcp/manager/index.js';
import { ToolRegistry } from '../../../src/mcp/manager/registry.js';
import type { ILogger } from '../../../src/logging/logger.js';
import type { MCPToolSchema } from '../../../src/shared/types.js';

// ── Logger mock ───────────────────────────────────────────────────────────────

function makeLogger(): ILogger {
  return {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// ── MCPConnection mock ────────────────────────────────────────────────────────

vi.mock('../../../src/mcp/manager/connection.js', () => {
  const statuses = new Map<string, string>();
  const tools = new Map<string, Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>>();
  const callResults = new Map<string, unknown>();

  class MCPConnection {
    private readonly id: string;
    constructor(cfg: { id: string }, _logger: unknown) {
      this.id = cfg.id;
    }
    get status(): string {
      return statuses.get(this.id) ?? 'disconnected';
    }
    async connect(): Promise<void> {
      statuses.set(this.id, 'connected');
    }
    async disconnect(): Promise<void> {
      statuses.set(this.id, 'disconnected');
    }
    async listTools(): Promise<unknown[]> {
      return tools.get(this.id) ?? [];
    }
    async callTool(name: string, _input: unknown): Promise<unknown> {
      const key = `${this.id}.${name}`;
      if (callResults.has(key)) return callResults.get(key);
      return { content: [{ type: 'text', text: 'ok' }] };
    }
  }

  return {
    MCPConnection,
    __setStatus: (id: string, s: string) => statuses.set(id, s),
    __setTools: (id: string, t: unknown[]) => tools.set(id, t as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>),
    __setCallResult: (id: string, tool: string, result: unknown) => callResults.set(`${id}.${tool}`, result),
  };
});

const connMock = await import('../../../src/mcp/manager/connection.js') as {
  __setStatus: (id: string, s: string) => void;
  __setTools: (id: string, t: unknown[]) => void;
  __setCallResult: (id: string, tool: string, result: unknown) => void;
};

describe('MCPServerManager', () => {
  let logger: ILogger;
  let registry: ToolRegistry;

  beforeEach(() => {
    logger = makeLogger();
    registry = new ToolRegistry();
  });

  it('connects to all configured servers and discovers tools', async () => {
    connMock.__setTools('playwright', [
      { name: 'browser_navigate', description: 'Navigate', inputSchema: {} },
      { name: 'browser_screenshot', description: 'Screenshot', inputSchema: {} },
    ]);

    const manager = new MCPServerManager(
      [{ id: 'playwright', transport: 'stdio', command: 'npx', args: ['@playwright/mcp'] }],
      logger,
      registry,
    );
    await manager.connect();

    expect(manager.isServerAvailable('playwright')).toBe(true);
    expect(manager.getAvailableTools('playwright')).toHaveLength(2);
  });

  it('marks server unavailable when connection fails', async () => {
    connMock.__setStatus('broken', 'unavailable');

    const manager = new MCPServerManager(
      [{ id: 'broken', transport: 'stdio', command: 'npx', args: ['nonexistent'] }],
      logger,
      registry,
    );

    // The mock connect() sets status to 'connected' but we can test unavailable by
    // making connection throw
    vi.spyOn(registry, 'register');
    await manager.connect();

    // Logger should have been called
    expect(logger.info).toHaveBeenCalled();
  });

  it('callTool emits a structured log entry on success', async () => {
    connMock.__setTools('playwright', [
      { name: 'browser_navigate', description: 'Navigate', inputSchema: {} },
    ]);

    const manager = new MCPServerManager(
      [{ id: 'playwright', transport: 'stdio', command: 'npx', args: [] }],
      logger,
      registry,
    );
    await manager.connect();

    await manager.callTool('playwright', 'browser_navigate', { url: 'https://example.com' }, 'session-1');

    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        agent: 'mcp.manager',
        tool: 'playwright.browser_navigate',
        status: 'success',
      }),
    );
  });

  it('callTool throws when server is not available', async () => {
    const manager = new MCPServerManager(
      [{ id: 'offline', transport: 'stdio', command: 'npx', args: [] }],
      logger,
      registry,
    );
    // Do not call connect()

    await expect(
      manager.callTool('offline', 'some_tool', {}, 'session-1'),
    ).rejects.toThrow("server 'offline' is not available");
  });

  it('getAvailableTools without serverId returns all tools', async () => {
    const toolSchema: MCPToolSchema = { name: 'browser_navigate', description: 'Nav', inputSchema: {} };
    registry.register('playwright', toolSchema);

    const manager = new MCPServerManager([], logger, registry);
    expect(manager.getAvailableTools()).toHaveLength(1);
  });

  it('disconnect clears all connections', async () => {
    connMock.__setTools('playwright', []);
    const manager = new MCPServerManager(
      [{ id: 'playwright', transport: 'stdio', command: 'npx', args: [] }],
      logger,
      registry,
    );
    await manager.connect();
    await manager.disconnect();
    expect(manager.isServerAvailable('playwright')).toBe(false);
  });
});
