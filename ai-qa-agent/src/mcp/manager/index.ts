import type { ILogger } from '@logging/logger.js';
import type { MCPToolSchema, ValidationWarning } from '@shared/types.js';
import { MCPConnection } from './connection.js';
import type { MCPConnectionConfig } from './connection.js';
import { ToolRegistry } from './registry.js';
import { withExponentialBackoff, defaultIsTransient } from './retry.js';

export type { MCPConnectionConfig as MCPServerConfig };

export interface CallToolResult {
  result: unknown;
  warning?: ValidationWarning;
}

export class MCPServerManager {
  private readonly _registry: ToolRegistry;
  private readonly _connections = new Map<string, MCPConnection>();

  constructor(
    private readonly _configs: MCPConnectionConfig[],
    private readonly _logger: ILogger,
    registry?: ToolRegistry,
  ) {
    this._registry = registry ?? new ToolRegistry();
  }

  async connect(): Promise<void> {
    await Promise.allSettled(
      this._configs.map(async (cfg) => {
        const conn = new MCPConnection(cfg, this._logger);
        this._connections.set(cfg.id, conn);
        try {
          await conn.connect();
          await this._discoverTools(conn, cfg.id);
        } catch (err) {
          this._logger.error(
            cfg.id,
            'mcp.manager',
            `Server unavailable: ${String(err)}`,
            [String(err)],
          );
        }
      }),
    );
  }

  private async _discoverTools(conn: MCPConnection, serverId: string): Promise<void> {
    const tools = await conn.listTools();
    for (const t of tools) {
      this._registry.register(serverId, {
        name: t.name,
        description: t.description ?? '',
        inputSchema: t.inputSchema ?? {},
      });
    }
    this._logger.info(
      serverId,
      'mcp.manager',
      'tools.discovered',
      {},
      { count: tools.length, tools: tools.map((t) => t.name) },
      0,
    );
  }

  async callTool(
    serverId: string,
    toolName: string,
    input: Record<string, unknown>,
    sessionId: string,
  ): Promise<CallToolResult> {
    const conn = this._connections.get(serverId);
    if (!conn || conn.status !== 'connected') {
      throw new Error(`MCPServerManager: server '${serverId}' is not available`);
    }

    const timeoutMs = 30_000;
    const start = Date.now();

    const callWithTimeout = async (): Promise<unknown> => {
      const callPromise = conn.callTool(toolName, input);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool call timeout after ${timeoutMs}ms`)), timeoutMs),
      );
      return Promise.race([callPromise, timeoutPromise]);
    };

    let result: unknown;
    try {
      result = await withExponentialBackoff(callWithTimeout, 3, 1000, defaultIsTransient);
    } catch (err) {
      const latency = Date.now() - start;
      this._logger.error(sessionId, 'mcp.manager', `Tool call failed: ${toolName}`, [String(err)]);
      this._logger.log({
        timestamp: new Date().toISOString(),
        sessionId,
        agent: 'mcp.manager',
        tool: `${serverId}.${toolName}`,
        input,
        output: {},
        latency,
        status: 'error',
        tokensUsed: 0,
        errors: [String(err)],
      });
      throw err;
    }

    const latency = Date.now() - start;
    this._logger.log({
      timestamp: new Date().toISOString(),
      sessionId,
      agent: 'mcp.manager',
      tool: `${serverId}.${toolName}`,
      input,
      output: typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : { result },
      latency,
      status: 'success',
      tokensUsed: 0,
      errors: [],
    });

    return { result };
  }

  getAvailableTools(serverId?: string): MCPToolSchema[] {
    return serverId !== undefined
      ? this._registry.getByServer(serverId)
      : this._registry.getAll();
  }

  isServerAvailable(serverId: string): boolean {
    const conn = this._connections.get(serverId);
    return conn?.status === 'connected';
  }

  async disconnect(): Promise<void> {
    await Promise.allSettled(
      Array.from(this._connections.values()).map((conn) => conn.disconnect()),
    );
    this._connections.clear();
  }
}
