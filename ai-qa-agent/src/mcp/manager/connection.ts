import type { ILogger } from '@logging/logger.js';

export type TransportType = 'stdio' | 'sse';

export interface MCPConnectionConfig {
  id: string;
  transport: TransportType;
  /** Used for stdio transport — the executable to spawn. */
  command?: string;
  args?: string[];
  /** Used for SSE transport. */
  url?: string;
  /** Connection timeout in ms (default: 10 000). */
  connectTimeoutMs?: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'unavailable';

export class MCPConnection {
  private _status: ConnectionStatus = 'disconnected';

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
    throw new Error('MCPConnection.connect() not yet implemented — see task 7.1');
  }


  async disconnect(): Promise<void> {
    throw new Error('MCPConnection.disconnect() not yet implemented — see task 7.1');
  }

 
  async callTool(
    _toolName: string,
    _input: Record<string, unknown>,
  ): Promise<unknown> {
    throw new Error('MCPConnection.callTool() not yet implemented — see task 7.1');
  }

 
  async listTools(): Promise<unknown[]> {
    throw new Error('MCPConnection.listTools() not yet implemented — see task 7.1');
  }
}
