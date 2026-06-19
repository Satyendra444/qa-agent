
import type { ILogger } from '@logging/logger.js';
import type { LogEntry, EvaluationReport } from '@shared/types.js';
import type { ISemanticEvaluator } from './deepeval.js';
import type { ReferenceDecision } from './metrics.js';

export interface EvaluationInput {
  sessionLog: LogEntry[];
  referenceDecisions?: ReferenceDecision[];
  groundedReference?: string;
  /** 0.0–1.0, default 0.7 */
  hallucinationThreshold?: number;
  costPerToken?: number;
}

export interface EvaluationOutput {
  report: EvaluationReport;
  /** Human-readable Markdown summary with a metric table. */
  markdownSummary: string;
}

export type EvaluationResult =
  | EvaluationOutput
  | { error: 'INVALID_SESSION_LOG'; reason: string };

export class AgentEvaluationFramework {
  constructor(
    private readonly _semanticEvaluator: ISemanticEvaluator,
    private readonly _logger: ILogger,
  ) {}


  async evaluate(_input: EvaluationInput): Promise<EvaluationResult> {
    throw new Error('AgentEvaluationFramework.evaluate() not yet implemented — see task 27.1');
  }
}
