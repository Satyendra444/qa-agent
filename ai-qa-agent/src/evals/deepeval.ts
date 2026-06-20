export interface SemanticEvaluationResult {
  similarity: number;
  passed: boolean;
  reason?: string;
}

export interface ISemanticEvaluator {
  evaluate(output: string, reference: string, threshold: number): Promise<SemanticEvaluationResult>;
}

export class DeepEvalAdapter implements ISemanticEvaluator {
  constructor(private readonly _defaultThreshold = 0.7) {}

  async evaluate(
    output: string,
    reference: string,
    threshold: number = this._defaultThreshold,
  ): Promise<SemanticEvaluationResult> {
    // Jaccard similarity on word tokens as a lightweight stand-in until
    // the promptfoo LLM-judge integration is wired (task 26.2).
    const tokenize = (s: string): Set<string> =>
      new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 2));

    const outTokens = tokenize(output);
    const refTokens = tokenize(reference);

    let intersection = 0;
    for (const t of outTokens) {
      if (refTokens.has(t)) intersection++;
    }

    const union = new Set([...outTokens, ...refTokens]).size;
    const similarity = union === 0 ? 0 : intersection / union;
    const passed = similarity >= threshold;

    return {
      similarity,
      passed,
      reason: passed
        ? `Similarity ${similarity.toFixed(3)} meets threshold ${threshold}`
        : `Similarity ${similarity.toFixed(3)} is below threshold ${threshold}`,
    };
  }
}
