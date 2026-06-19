import type { ILogger } from '@logging/logger.js';
import type { ExecutionResult, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';

export type ExecutionAgentResult = ExecutionResult | AgentError;

/** Session-level execution timeout (Requirement 8.6). */
export const EXECUTION_TIMEOUT_MS = 300_000;

export class ExecutionAgent {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
  ) {}

  async execute(_scriptPaths: string[]): Promise<ExecutionAgentResult> {
    throw new Error('ExecutionAgent.execute() not yet implemented — see task 16.1');
  }
}
