
import type { MCPToolSchema } from '@shared/types.js';

export class ToolRegistry {
  private readonly _tools = new Map<string, MCPToolSchema>();

  register(serverId: string, schema: MCPToolSchema): void {
    // TODO (task 6.1): validate schema before registering
    const key = `${serverId}.${schema.name}`;
    this._tools.set(key, schema);
  }

  /** Returns the schema for `{serverId}.{toolName}`, or `undefined` if not found. */
  get(serverId: string, toolName: string): MCPToolSchema | undefined {
    return this._tools.get(`${serverId}.${toolName}`);
  }

  /** Returns all registered tool schemas. */
  getAll(): MCPToolSchema[] {
    return Array.from(this._tools.values());
  }

  /** Returns all tools registered under the given server id. */
  getByServer(serverId: string): MCPToolSchema[] {
    const prefix = `${serverId}.`;
    return Array.from(this._tools.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([, schema]) => schema);
  }

  /** Returns every registered namespaced key. */
  keys(): string[] {
    return Array.from(this._tools.keys());
  }

  /** Total number of registered tools. */
  get size(): number {
    return this._tools.size;
  }

  /** Removes all tools registered under `serverId`. */
  removeServer(serverId: string): void {
    const prefix = `${serverId}.`;
    for (const key of this._tools.keys()) {
      if (key.startsWith(prefix)) {
        this._tools.delete(key);
      }
    }
  }

  /** Clears all registrations. */
  clear(): void {
    this._tools.clear();
  }
}
