import type { ILogger } from '@logging/logger.js';
import type { EvaluationReport, ExecutionResult, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';
import type { ISemanticEvaluator } from '@evals/deepeval.js';

export type EvaluationAgentResult = EvaluationReport | AgentError;

export class EvaluationAgent {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
    private readonly _semanticEvaluator: ISemanticEvaluator,
  ) {}

  async evaluate(
    _executionResult: ExecutionResult,
    _requirement: string,
  ): Promise<EvaluationAgentResult> {
    throw new Error('EvaluationAgent.evaluate() not yet implemented — see task 17.1');
  }
}
