import type { ILogger } from '@logging/logger.js';
import type { LogEntry, EvaluationReport } from '@shared/types.js';
import type { ISemanticEvaluator } from './deepeval.js';
import type { ReferenceDecision } from './metrics.js';
import {
  computeTaskSuccessRate, computeToolAccuracy, computeHallucinationRate,
  computeAverageLatency, computeTokenUsage, computeFailureRate, computeCostPerExecution,
} from './metrics.js';

export interface EvaluationInput {
  sessionId: string;
  sessionLog: LogEntry[];
  referenceDecisions?: ReferenceDecision[];
  groundedReference?: string;
  hallucinationThreshold?: number;
  costPerToken?: number;
}

export interface EvaluationOutput {
  report: EvaluationReport;
  markdownSummary: string;
}

export type EvaluationResult =
  | EvaluationOutput
  | { error: 'INVALID_SESSION_LOG'; reason: string };

function isValidLog(log: LogEntry[]): boolean {
  if (!Array.isArray(log) || log.length === 0) return false;
  return log.every(
    (e) =>
      typeof e.timestamp === 'string' &&
      typeof e.sessionId === 'string' &&
      typeof e.agent === 'string' &&
      typeof e.latency === 'number' &&
      typeof e.tokensUsed === 'number',
  );
}

function buildMarkdown(report: EvaluationReport): string {
  const m = report.metrics;
  const rows = [
    ['TaskSuccessRate', m.TaskSuccessRate.toFixed(4)],
    ['ToolAccuracy', m.ToolAccuracy !== null ? m.ToolAccuracy.toFixed(4) : 'N/A'],
    ['HallucinationRate', m.HallucinationRate !== null ? m.HallucinationRate.toFixed(4) : 'N/A'],
    ['AverageLatency (ms)', m.AverageLatency.toFixed(2)],
    ['TokenUsage', String(m.TokenUsage)],
    ['FailureRate', m.FailureRate.toFixed(4)],
    ['CostPerExecution ($)', m.CostPerExecution.toFixed(6)],
  ];

  const table = [
    '| Metric | Value |',
    '|---|---|',
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
  ].join('\n');

  const hallucSection =
    report.hallucinations.length > 0
      ? `\n\n### Hallucinations (${report.hallucinations.length})\n` +
        report.hallucinations.map((h) => `- **${h.content}**: ${h.reason}`).join('\n')
      : '\n\n### Hallucinations\nNone detected.';

  return `## Evaluation Report — Session ${report.sessionId}\n\nGenerated at: ${report.generatedAt}\n\n${table}${hallucSection}`;
}

export class AgentEvaluationFramework {
  constructor(
    private readonly _semanticEvaluator: ISemanticEvaluator,
    private readonly _logger: ILogger,
  ) {}

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    if (!isValidLog(input.sessionLog)) {
      return {
        error: 'INVALID_SESSION_LOG',
        reason: 'Session log is empty or contains entries missing required fields',
      };
    }

    const {
      sessionId, sessionLog, referenceDecisions, groundedReference,
      hallucinationThreshold = 0.7, costPerToken = 0.000001,
    } = input;

    const tokenUsage = computeTokenUsage(sessionLog);

    let hallucinationRate: number | null = null;
    if (groundedReference) {
      const outputs = sessionLog.map((e) => JSON.stringify(e.output)).join(' ');
      const evalResult = await this._semanticEvaluator.evaluate(
        outputs, groundedReference, hallucinationThreshold,
      );
      hallucinationRate = 1 - evalResult.similarity;
    }

    const report: EvaluationReport = {
      sessionId,
      metrics: {
        TaskSuccessRate: computeTaskSuccessRate(sessionLog),
        ToolAccuracy: computeToolAccuracy(sessionLog, referenceDecisions),
        HallucinationRate: hallucinationRate ?? computeHallucinationRate(sessionLog, groundedReference, hallucinationThreshold),
        AverageLatency: computeAverageLatency(sessionLog),
        TokenUsage: tokenUsage,
        FailureRate: computeFailureRate(sessionLog),
        CostPerExecution: computeCostPerExecution(tokenUsage, costPerToken),
      },
      hallucinations: [],
      recommendations: [],
      generatedAt: new Date().toISOString(),
    };

    this._logger.info(
      sessionId, 'eval.framework', 'evaluate.complete',
      { logEntries: sessionLog.length },
      { TaskSuccessRate: report.metrics.TaskSuccessRate, FailureRate: report.metrics.FailureRate },
      0,
    );

    return { report, markdownSummary: buildMarkdown(report) };
  }
}
