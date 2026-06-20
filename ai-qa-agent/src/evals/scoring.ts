import type { EvaluationMetrics, EvaluationScore } from '@shared/types.js';

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function scoreLatency(latencyMs: number): number {
  if (latencyMs <= 250) return 1;
  if (latencyMs >= 2000) return 0;
  return 1 - (latencyMs - 250) / (2000 - 250);
}

function scoreCost(cost: number): number {
  if (cost <= 0.005) return 1;
  if (cost >= 0.1) return 0;
  return 1 - (cost - 0.005) / (0.1 - 0.005);
}

export function computeEvaluationScore(metrics: EvaluationMetrics): EvaluationScore {
  const goalCompletion = clamp(metrics.GoalCompletion);
  const toolAccuracy = clamp(metrics.ToolAccuracy ?? 0);
  const semanticSimilarity = clamp(metrics.SemanticSimilarity ?? 0);
  const hallucinationResistance = clamp(metrics.HallucinationRate === null ? 1 : 1 - metrics.HallucinationRate);
  const recoveryRate = clamp(metrics.RecoveryRate);
  const latencyScore = clamp(scoreLatency(metrics.AverageLatency));
  const costScore = clamp(scoreCost(metrics.CostPerExecution));

  const weights = {
    GoalCompletion: 0.18,
    ToolAccuracy: 0.18,
    SemanticSimilarity: 0.16,
    HallucinationResistance: 0.16,
    RecoveryRate: 0.12,
    LatencyScore: 0.10,
    CostScore: 0.10,
  };

  const overall =
    goalCompletion * weights.GoalCompletion +
    toolAccuracy * weights.ToolAccuracy +
    semanticSimilarity * weights.SemanticSimilarity +
    hallucinationResistance * weights.HallucinationResistance +
    recoveryRate * weights.RecoveryRate +
    latencyScore * weights.LatencyScore +
    costScore * weights.CostScore;

  return {
    overall: clamp(overall),
    components: {
      GoalCompletion: goalCompletion,
      ToolAccuracy: toolAccuracy,
      SemanticSimilarity: semanticSimilarity,
      HallucinationResistance: hallucinationResistance,
      RecoveryRate: recoveryRate,
      LatencyScore: latencyScore,
      CostScore: costScore,
    },
  };
}
