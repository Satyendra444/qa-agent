import type { ILogger } from '@logging/logger.js';
import type { EvaluationReport, ExecutionResult, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';
import type { ISemanticEvaluator } from '@evals/deepeval.js';
import { HallucinationDetector } from '@evals/hallucination.js';
import {
  computeGoalCompletion,
  computeTaskSuccessRate,
  computeToolAccuracy,
  computeHallucinationRate,
  computeRecoveryRate,
  computeSemanticSimilarity,
  computeAverageLatency,
  computeTokenUsage,
  computeFailureRate,
  computeCostPerExecution,
} from '@evals/metrics.js';
import { computeEvaluationScore } from '@evals/scoring.js';
import type { LogEntry } from '@shared/types.js';

export type EvaluationAgentResult = EvaluationReport | AgentError;

export class EvaluationAgent {
  private readonly _detector = new HallucinationDetector();

  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
    private readonly _semanticEvaluator: ISemanticEvaluator,
    private readonly _costPerToken = 0.000001,
    private readonly _hallucinationThreshold = 0.7,
  ) {}

  async evaluate(
    executionResult: ExecutionResult,
    requirement: string,
    sessionLog: LogEntry[] = [],
  ): Promise<EvaluationAgentResult> {
    const start = Date.now();

    const tokenUsage = computeTokenUsage(sessionLog);
    const taskSuccessRate = sessionLog.length > 0
      ? computeTaskSuccessRate(sessionLog)
      : executionResult.passed / Math.max(executionResult.totalTests, 1);

    const failureRate = sessionLog.length > 0
      ? computeFailureRate(sessionLog)
      : executionResult.failed / Math.max(executionResult.totalTests, 1);

    // Hallucination detection on test result content
    const testContent = executionResult.tests
      .map((t) => `${t.title} ${t.errorMessage ?? ''}`)
      .join(' ');
    const hallucinations = this._detector.detect(testContent, requirement);

    // Semantic evaluation against requirement
    let hallucinationRate: number | null = null;
    try {
      if (testContent.trim().length > 0) {
        const semResult = await this._semanticEvaluator.evaluate(
          testContent, requirement, this._hallucinationThreshold,
        );
        hallucinationRate = 1 - semResult.similarity;
      }
    } catch {
      hallucinationRate = null;
    }

    const report: EvaluationReport = {
      sessionId: this._sessionId,
      metrics: {
        GoalCompletion: sessionLog.length > 0 ? computeGoalCompletion(sessionLog) : taskSuccessRate,
        TaskSuccessRate: taskSuccessRate,
        ToolAccuracy: sessionLog.length > 0 ? computeToolAccuracy(sessionLog) : null,
        SemanticSimilarity: hallucinationRate !== null ? 1 - hallucinationRate : null,
        HallucinationRate: hallucinationRate,
        RecoveryRate: sessionLog.length > 0 ? computeRecoveryRate(sessionLog) : 0,
        AverageLatency: sessionLog.length > 0 ? computeAverageLatency(sessionLog) : 0,
        TokenUsage: tokenUsage,
        FailureRate: failureRate,
        CostPerExecution: computeCostPerExecution(tokenUsage, this._costPerToken),
      },
      score: computeEvaluationScore({
        GoalCompletion: sessionLog.length > 0 ? computeGoalCompletion(sessionLog) : taskSuccessRate,
        TaskSuccessRate: taskSuccessRate,
        ToolAccuracy: sessionLog.length > 0 ? computeToolAccuracy(sessionLog) : null,
        SemanticSimilarity: hallucinationRate !== null ? 1 - hallucinationRate : null,
        HallucinationRate: hallucinationRate,
        RecoveryRate: sessionLog.length > 0 ? computeRecoveryRate(sessionLog) : 0,
        AverageLatency: sessionLog.length > 0 ? computeAverageLatency(sessionLog) : 0,
        TokenUsage: tokenUsage,
        FailureRate: failureRate,
        CostPerExecution: computeCostPerExecution(tokenUsage, this._costPerToken),
      }),
      hallucinations,
      recommendations: this._buildRecommendations(taskSuccessRate, failureRate, hallucinations.length),
      generatedAt: new Date().toISOString(),
    };

    const latency = Date.now() - start;
    this._logger.info(
      this._sessionId, 'evaluation.agent', 'evaluate',
      { testCount: executionResult.totalTests },
      { TaskSuccessRate: report.metrics.TaskSuccessRate, FailureRate: report.metrics.FailureRate },
      latency,
    );

    await this._persistReport(report);
    return report;
  }

  private _buildRecommendations(
    successRate: number,
    failureRate: number,
    hallucinationCount: number,
  ): string[] {
    const recs: string[] = [];
    if (successRate < 0.8) recs.push('Task success rate is below 80% — review test coverage and preconditions');
    if (failureRate > 0.2) recs.push('Tool failure rate exceeds 20% — check MCP server stability and network conditions');
    if (hallucinationCount > 0) recs.push(`${hallucinationCount} potential hallucination(s) detected — review generated content against the original requirement`);
    return recs;
  }

  private async _persistReport(report: EvaluationReport): Promise<void> {
    const payload = JSON.stringify(report);

    if (this._manager.isServerAvailable('postgres')) {
      try {
        await this._manager.callTool(
          'postgres', 'query',
          {
            sql: `INSERT INTO evaluation_reports (session_id, metrics, hallucinations, recommendations, generated_at)
                  VALUES ($1,$2,$3,$4,$5) ON CONFLICT (session_id) DO UPDATE
                  SET metrics=$2, hallucinations=$3, recommendations=$4, generated_at=$5`,
            params: [
              report.sessionId,
              JSON.stringify(report.metrics),
              JSON.stringify(report.hallucinations),
              JSON.stringify(report.recommendations),
              report.generatedAt,
            ],
          },
          this._sessionId,
        );
      } catch (err) {
        this._logger.warn(this._sessionId, 'evaluation.agent', `PostgreSQL persist failed: ${String(err)}`);
      }
    }

    if (this._manager.isServerAvailable('filesystem')) {
      try {
        await this._manager.callTool(
          'filesystem', 'write_file',
          { path: `sessions/${this._sessionId}/eval-report.json`, content: payload },
          this._sessionId,
        );
      } catch (err) {
        this._logger.warn(this._sessionId, 'evaluation.agent', `Filesystem persist failed: ${String(err)}`);
      }
    }
  }
}
