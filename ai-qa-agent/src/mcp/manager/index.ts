

import type { ILogger } from '@logging/logger.js';
import type { MCPToolSchema, ValidationWarning } from '@shared/types.js';
import type { MCPConnectionConfig } from './connection.js';
import { ToolRegistry } from './registry.js';

export type { MCPConnectionConfig as MCPServerConfig };

export interface CallToolResult {
  result: unknown;
  warning?: ValidationWarning;
}

export class MCPServerManager {
  private readonly _registry: ToolRegistry;

  constructor(
    private readonly _configs: MCPConnectionConfig[],
    private readonly _logger: ILogger,
    registry?: ToolRegistry,
  ) {
    this._registry = registry ?? new ToolRegistry();
  }

 
  async connect(): Promise<void> {
    throw new Error('MCPServerManager.connect() not yet implemented — see task 7.3');
  }


  async callTool(
    _serverId: string,
    _toolName: string,
    _input: Record<string, unknown>,
    _sessionId: string,
  ): Promise<CallToolResult> {
    throw new Error('MCPServerManager.callTool() not yet implemented — see task 7.3');
  }

  /** Returns all registered tools (optionally filtered by server id). */
  getAvailableTools(serverId?: string): MCPToolSchema[] {
    return serverId !== undefined
      ? this._registry.getByServer(serverId)
      : this._registry.getAll();
  }

  
  isServerAvailable(_serverId: string): boolean {
    throw new Error('MCPServerManager.isServerAvailable() not yet implemented — see task 7.3');
  }

  
  async disconnect(): Promise<void> {
    throw new Error('MCPServerManager.disconnect() not yet implemented — see task 7.3');
  }
}
