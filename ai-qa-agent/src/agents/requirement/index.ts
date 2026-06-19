
import type { ILogger } from '@logging/logger.js';
import type { Scenario, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';

export interface RequirementOutput {
  scenarios: Scenario[];
  extractionIncomplete?: true;
}

export type RequirementResult =
  | RequirementOutput
  | (AgentError & { extractionIncomplete?: true });

export class RequirementAgent {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
  ) {}

  async analyze(_requirement: string): Promise<RequirementResult> {
    throw new Error('RequirementAgent.analyze() not yet implemented — see task 10.1');
  }
}
