import type { ILogger } from '@logging/logger.js';
import type { Scenario, TestCase, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';

export interface TestCaseOutput {
  testCases: TestCase[];
}

export type TestCaseResult = TestCaseOutput | AgentError;

export class TestCaseAgent {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
  ) {}

  async generate(_scenarios: Scenario[]): Promise<TestCaseResult> {
    throw new Error('TestCaseAgent.generate() not yet implemented — see task 14.1');
  }
}
