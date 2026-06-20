import type { LogEntry } from '@shared/types.js';

export interface ReferenceDecision {
  toolCall: string;
  optimalTool: string;
}

export interface ToolAccuracyDecision {
  toolCall: string;
  optimalTool: string;
}

export interface RecoveryEvent {
  sessionId: string;
  fromStatus: string;
  toStatus: string;
  tool: string;
}

export function computeGoalCompletion(log: LogEntry[]): number {
  const taskEvents = log.filter((e) => e.agent !== 'mcp.manager');
  if (taskEvents.length === 0) return 0;
  const completed = taskEvents.filter((e) => e.status === 'success').length;
  return completed / taskEvents.length;
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

export function computeSemanticSimilarity(
  similarity: number | null,
): number | null {
  return similarity;
}

export function computeRecoveryRate(log: LogEntry[]): number {
  const transitions = log
    .filter((e) => e.agent !== 'mcp.manager')
    .map((e) => e.status);

  if (transitions.length < 2) return 0;

  let recoveries = 0;
  for (let i = 1; i < transitions.length; i += 1) {
    if (transitions[i - 1] === 'error' && transitions[i] === 'success') {
      recoveries += 1;
    }
  }

  return recoveries / Math.max(transitions.length - 1, 1);
}

export function computeHallucinationRate(
  similarity: number | null,
): number | null {
  if (similarity === null) return null;
  return 1 - similarity;
}

export function computeAverageLatency(log: LogEntry[]): number {
  if (log.length === 0) return 0;
  const total = log.reduce((sum, e) => sum + e.latency, 0);
  return total / log.length;
}

export function computeTokenUsage(log: LogEntry[]): number {
  return log.reduce((sum, e) => sum + e.tokens, 0);
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
