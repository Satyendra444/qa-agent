

export interface SemanticEvaluationResult {
  similarity: number;   // 0.0–1.0
  passed: boolean;
  reason?: string;
}

/**
 * Abstraction over the concrete evaluation library so unit tests can
 * inject a mock without importing DeepEval/Promptfoo.
 */
export interface ISemanticEvaluator {
  /**
   * Computes similarity between `output` and `reference`.
   * Returns a score in [0, 1] and whether it meets the threshold.
   */
  evaluate(
    output: string,
    reference: string,
    threshold: number,
  ): Promise<SemanticEvaluationResult>;
}

/**
 * Concrete adapter backed by DeepEval / Promptfoo.
 * TODO (task 26.2): implement using the promptfoo package.
 */
export class DeepEvalAdapter implements ISemanticEvaluator {
  constructor(
    /** Similarity threshold (0.0–1.0, default 0.7). */
    private readonly _defaultThreshold = 0.7,
  ) {}

  async evaluate(
    _output: string,
    _reference: string,
    _threshold: number = this._defaultThreshold,
  ): Promise<SemanticEvaluationResult> {
    throw new Error('DeepEvalAdapter.evaluate() not yet implemented — see task 26.2');
  }
}
