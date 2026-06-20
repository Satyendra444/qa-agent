export type QATaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying';

export type QAStage =
  | 'plan'
  | 'execute'
  | 'validate'
  | 'report'
  | 'completed'
  | 'failed';

export interface PlannedAction {
  id: string;
  toolName: string;
  serverId: string;
  input: Record<string, unknown>;
  description: string;
  retries: number;
}

export interface ActionResult {
  actionId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  status: 'success' | 'failure' | 'timeout';
  latencyMs: number;
  error?: string;
  attempt: number;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  actual: string;
  expected: string;
  error?: string;
}

export interface QAReport {
  sessionId: string;
  task: string;
  status: 'passed' | 'failed' | 'partial';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  actions: ActionResult[];
  validations: ValidationCheck[];
  summary: string;
  errors: string[];
}

export interface QAAgentState {
  sessionId: string;
  task: string;
  stage: QAStage;
  plannedActions: PlannedAction[];
  executedActions: ActionResult[];
  validations: ValidationCheck[];
  retryCount: Record<string, number>;
  errors: string[];
  startedAt: string;
  report: QAReport | null;
}

export interface MemoryEntry {
  sessionId: string;
  task: string;
  actions: PlannedAction[];
  report: QAReport;
  timestamp: string;
}
