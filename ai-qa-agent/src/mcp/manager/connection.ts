import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { ILogger } from '@logging/logger.js';
import { withExponentialBackoff, defaultIsTransient } from './retry.js';

export type TransportType = 'stdio' | 'sse';

export interface MCPConnectionConfig {
  id: string;
  transport: TransportType;
  command?: string;
  args?: string[];
  url?: string;
  connectTimeoutMs?: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'unavailable';

interface RawTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export class MCPConnection {
  private _status: ConnectionStatus = 'disconnected';
  private _client: Client | null = null;

  constructor(
    private readonly _config: MCPConnectionConfig,
    private readonly _logger: ILogger,
  ) {}

  get id(): string {
    return this._config.id;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    const timeoutMs = this._config.connectTimeoutMs ?? 10_000;
    this._status = 'connecting';

    const connectOnce = async (): Promise<void> => {
      const client = new Client({ name: `qa-agent-${this._config.id}`, version: '0.1.0' });

      let transport: StdioClientTransport | SSEClientTransport;

      if (this._config.transport === 'stdio') {
        if (!this._config.command) {
          throw new Error(`MCPConnection [${this._config.id}]: stdio transport requires 'command'`);
        }
        transport = new StdioClientTransport({
          command: this._config.command,
          args: this._config.args ?? [],
        });
      } else {
        if (!this._config.url) {
          throw new Error(`MCPConnection [${this._config.id}]: sse transport requires 'url'`);
        }
        transport = new SSEClientTransport(new URL(this._config.url));
      }

      const connectPromise = client.connect(transport);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs),
      );

      await Promise.race([connectPromise, timeoutPromise]);
      this._client = client;
    };

    try {
      await connectOnce();
      this._status = 'connected';
      this._logger.info(this._config.id, 'mcp.connection', 'connect', {}, { status: 'connected' }, 0);
    } catch (err) {
      this._status = 'unavailable';
      this._logger.error(
        this._config.id,
        'mcp.connection',
        `Failed to connect: ${String(err)}`,
        [String(err)],
      );
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this._client) {
      await this._client.close();
      this._client = null;
    }
    this._status = 'disconnected';
    this._logger.info(this._config.id, 'mcp.connection', 'disconnect', {}, { status: 'disconnected' }, 0);
  }

  async callTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    if (!this._client) {
      throw new Error(`MCPConnection [${this._config.id}]: not connected`);
    }
    const result = await this._client.callTool({ name: toolName, arguments: input });
    return result;
  }

  async listTools(): Promise<RawTool[]> {
    if (!this._client) {
      throw new Error(`MCPConnection [${this._config.id}]: not connected`);
    }
    const response = await this._client.listTools();
    return (response.tools ?? []) as RawTool[];
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await withExponentialBackoff(
      () => this.connect(),
      3,
      1000,
      defaultIsTransient,
    );
  }
}
