import type { LogEntry } from '@shared/types.js';

export interface ReferenceDecision {
  toolCall: string;
  optimalTool: string;
}

export function computeTaskSuccessRate(log: LogEntry[]): number {
  const tasks = log.filter((e) => e.agent !== 'mcp.manager');
  if (tasks.length === 0) return 0;
  const succeeded = tasks.filter((e) => e.status === 'success').length;
  return succeeded / tasks.length;
}

export function computeToolAccuracy(
  log: LogEntry[],
  referenceDecisions?: ReferenceDecision[],
): number | null {
  if (!referenceDecisions || referenceDecisions.length === 0) return null;

  const toolCalls = log.filter((e) => e.agent === 'mcp.manager');
  if (toolCalls.length === 0) return null;

  const refMap = new Map(referenceDecisions.map((r) => [r.toolCall, r.optimalTool]));
  let correct = 0;
  let compared = 0;

  for (const entry of toolCalls) {
    const optimal = refMap.get(entry.tool);
    if (optimal !== undefined) {
      compared++;
      if (entry.tool === optimal) correct++;
    }
  }

  return compared === 0 ? null : correct / compared;
}

export function computeHallucinationRate(
  _log: LogEntry[],
  _groundedRef?: string,
  _threshold?: number,
): number | null {
  // Requires semantic evaluation — returns null until DeepEval adapter is wired
  return null;
}

export function computeAverageLatency(log: LogEntry[]): number {
  if (log.length === 0) return 0;
  const total = log.reduce((sum, e) => sum + e.latency, 0);
  return total / log.length;
}

export function computeTokenUsage(log: LogEntry[]): number {
  return log.reduce((sum, e) => sum + e.tokensUsed, 0);
}

export function computeFailureRate(log: LogEntry[]): number {
  const toolCalls = log.filter((e) => e.agent === 'mcp.manager');
  if (toolCalls.length === 0) return 0;
  const failed = toolCalls.filter((e) => e.status === 'error' || e.status === 'failure').length;
  return failed / toolCalls.length;
}

export function computeCostPerExecution(tokenUsage: number, costPerToken: number): number {
  return tokenUsage * costPerToken;
}
