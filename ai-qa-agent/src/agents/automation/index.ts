import type { ILogger } from '@logging/logger.js';
import type { TestCase, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';

export interface AutomationOutput {
  scriptPaths: string[];
  pomPaths: string[];
}

export type AutomationResult = AutomationOutput | AgentError;

export class AutomationAgent {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
  ) {}


  async generate(_testCases: TestCase[]): Promise<AutomationResult> {
    throw new Error('AutomationAgent.generate() not yet implemented — see task 15.2');
  }
}
