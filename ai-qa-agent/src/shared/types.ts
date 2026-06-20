export interface LogEntry {
  timestamp: string;        // ISO8601
  sessionId: string;
  agent: string;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  latency: number;          // ms
  status: string;
  tokens: number;
  cost: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface Session {
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  requirement: string;
  currentAgent: string | null;
  outputs: Record<string, unknown>;
  errors: string[];
  startedAt: string;        // ISO8601
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Requirement Agent outputs
// ---------------------------------------------------------------------------

export interface Scenario {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  edgeCases: string[];
}

// ---------------------------------------------------------------------------
// Test Case Agent outputs
// ---------------------------------------------------------------------------

export interface TestCase {
  id: string;
  title: string;
  type: 'positive' | 'negative' | 'edge';
  preconditions: string[];
  steps: string[];
  expectedResult: string;
}

// ---------------------------------------------------------------------------
// Execution Agent outputs
// ---------------------------------------------------------------------------

export interface ExecutionResult {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;         // ms
  tests: TestResult[];
}

export interface TestResult {
  testId: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  errorMessage: string | null;
  failureCategory?: 'assertion_error' | 'infrastructure_error';
  artifactPaths: {
    screenshot?: string;
    video?: string;
    trace?: string;
  };
}

// ---------------------------------------------------------------------------
// Evaluation Agent outputs
// ---------------------------------------------------------------------------

export interface EvaluationReport {
  sessionId: string;
  metrics: EvaluationMetrics;
  score: EvaluationScore;
  hallucinations: HallucinationFlag[];
  recommendations: string[];
  generatedAt: string;      // ISO8601
}

export interface EvaluationMetrics {
  GoalCompletion: number;
  TaskSuccessRate: number;
  ToolAccuracy: number | null;
  SemanticSimilarity: number | null;
  HallucinationRate: number | null;
  RecoveryRate: number;
  AverageLatency: number;
  TokenUsage: number;
  FailureRate: number;
  CostPerExecution: number;
}

export interface EvaluationScore {
  overall: number;
  components: {
    GoalCompletion: number;
    ToolAccuracy: number;
    SemanticSimilarity: number;
    HallucinationResistance: number;
    RecoveryRate: number;
    LatencyScore: number;
    CostScore: number;
  };
}

export interface HallucinationFlag {
  content: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------

export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;   // JSON Schema
  outputSchema?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Orchestrator / Pipeline
// ---------------------------------------------------------------------------

export interface PipelineState {
  sessionId: string;
  requirement: string;
  scenarios: Scenario[];
  testCases: TestCase[];
  scriptPaths: string[];
  executionResult: ExecutionResult | null;
  evaluationReport: EvaluationReport | null;
  errors: Array<{ stage: string; message: string }>;
  retryCount: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationWarning {
  valid: false;
  violations: string[];
}

// ---------------------------------------------------------------------------
// Error shapes
// ---------------------------------------------------------------------------

export interface AgentError {
  error: string;
  reason: string;
  stage?: string;
}

export interface MCPError {
  error: string;
  serverId: string;
  toolName?: string;
  reason: string;
}

export interface APIError {
  error: string;
  statusCode: number;
  message: string;
}
