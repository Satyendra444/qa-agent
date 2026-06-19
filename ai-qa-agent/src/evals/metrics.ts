import type { LogEntry } from '@shared/types.js';

export interface ReferenceDecision {
  toolCall: string;
  optimalTool: string;
}

/**
 * Ratio of tasks with status "success" to total tasks.
 * TODO (task 25.1): implement.
 */
export function computeTaskSuccessRate(_log: LogEntry[]): number {
  throw new Error('computeTaskSuccessRate() not yet implemented — see task 25.1');
}

/**
 * Ratio of tool calls matching optimalTool in referenceDecisions; null if no
 * reference set is provided.
 * TODO (task 25.1): implement.
 */
export function computeToolAccuracy(
  _log: LogEntry[],
  _referenceDecisions?: ReferenceDecision[],
): number | null {
  throw new Error('computeToolAccuracy() not yet implemented — see task 25.1');
}

/**
 * Semantic similarity–based hallucination rate; null if no grounded reference.
 * TODO (task 25.1): implement (returns null placeholder until task 26 integrates DeepEval).
 */
export function computeHallucinationRate(
  _log: LogEntry[],
  _groundedRef?: string,
  _threshold?: number,
): number | null {
  throw new Error('computeHallucinationRate() not yet implemented — see task 25.1');
}

/**
 * Mean of all latency values in the session log.
 * TODO (task 25.1): implement.
 */
export function computeAverageLatency(_log: LogEntry[]): number {
  throw new Error('computeAverageLatency() not yet implemented — see task 25.1');
}

/**
 * Sum of all tokensUsed values.
 * TODO (task 25.1): implement.
 */
export function computeTokenUsage(_log: LogEntry[]): number {
  throw new Error('computeTokenUsage() not yet implemented — see task 25.1');
}

/**
 * Ratio of tool calls with status "failure" to all tool calls.
 * TODO (task 25.1): implement.
 */
export function computeFailureRate(_log: LogEntry[]): number {
  throw new Error('computeFailureRate() not yet implemented — see task 25.1');
}

/**
 * tokenUsage × costPerToken.
 * TODO (task 25.1): implement.
 */
export function computeCostPerExecution(tokenUsage: number, costPerToken: number): number {
  throw new Error('computeCostPerExecution() not yet implemented — see task 25.1');
}
