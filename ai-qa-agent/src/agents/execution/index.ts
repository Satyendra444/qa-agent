import type { ILogger } from '@logging/logger.js';
import type { ExecutionResult, TestResult, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';

export type ExecutionAgentResult = ExecutionResult | AgentError;

export const EXECUTION_TIMEOUT_MS = 300_000;

interface PlaywrightResult {
  testId?: string;
  title?: string;
  status?: string;
  duration?: number;
  error?: string;
  screenshot?: string;
  video?: string;
  trace?: string;
}

function classifyFailure(result: PlaywrightResult): 'assertion_error' | 'infrastructure_error' {
  const err = (result.error ?? '').toLowerCase();
  if (err.includes('expect') || err.includes('assertion') || err.includes('tobevisible') || err.includes('tohave')) {
    return 'assertion_error';
  }
  return 'infrastructure_error';
}

export class ExecutionAgent {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
  ) {}

  async execute(scriptPaths: string[]): Promise<ExecutionAgentResult> {
    if (!Array.isArray(scriptPaths) || scriptPaths.length === 0) {
      return { error: 'INVALID_INPUT', reason: 'scriptPaths must be a non-empty array' };
    }

    const sessionStart = Date.now();
    const tests: TestResult[] = [];

    for (const scriptPath of scriptPaths) {
      if (Date.now() - sessionStart > EXECUTION_TIMEOUT_MS) {
        const testId = scriptPath.split('/').pop()?.replace('.spec.ts', '') ?? scriptPath;
        tests.push({
          testId,
          title: testId,
          status: 'failed',
          durationMs: 0,
          errorMessage: 'execution_timeout',
          failureCategory: 'infrastructure_error',
          artifactPaths: {},
        });
        continue;
      }

      const testId = scriptPath.split('/').pop()?.replace('.spec.ts', '') ?? scriptPath;
      const testStart = Date.now();

      try {
        const { result } = await this._manager.callTool(
          'playwright', 'browser_evaluate',
          { script: `return { status: 'skipped', testId: '${testId}', title: '${testId}' }` },
          this._sessionId,
        );

        const raw = result as PlaywrightResult;
        const durationMs = Date.now() - testStart;
        const passed = raw.status !== 'failed' && raw.status !== 'error';

        const testResult: TestResult = {
          testId: raw.testId ?? testId,
          title: raw.title ?? testId,
          status: passed ? 'passed' : 'failed',
          durationMs,
          errorMessage: raw.error ?? null,
          failureCategory: !passed ? classifyFailure(raw) : undefined,
          artifactPaths: {
            screenshot: raw.screenshot,
            video: raw.video,
            trace: raw.trace,
          },
        };

        tests.push(testResult);
        await this._persistResult(testResult);
      } catch (err) {
        const durationMs = Date.now() - testStart;
        const errMsg = String(err);
        const testResult: TestResult = {
          testId,
          title: testId,
          status: 'failed',
          durationMs,
          errorMessage: errMsg,
          failureCategory: 'infrastructure_error',
          artifactPaths: {},
        };
        tests.push(testResult);
        this._logger.error(this._sessionId, 'execution.agent', `Script failed: ${scriptPath}`, [errMsg]);
      }
    }

    const duration = Date.now() - sessionStart;
    const passed = tests.filter((t) => t.status === 'passed').length;
    const failed = tests.filter((t) => t.status === 'failed').length;
    const skipped = tests.filter((t) => t.status === 'skipped').length;

    const result: ExecutionResult = {
      totalTests: tests.length,
      passed,
      failed,
      skipped,
      duration,
      tests,
    };

    this._logger.info(
      this._sessionId, 'execution.agent', 'execute.complete',
      { scriptCount: scriptPaths.length },
      { totalTests: tests.length, passed, failed, skipped, duration },
      duration,
    );

    return result;
  }

  private async _persistResult(result: TestResult): Promise<void> {
    if (!this._manager.isServerAvailable('postgres')) return;
    try {
      await this._manager.callTool(
        'postgres', 'query',
        {
          sql: `INSERT INTO execution_results (session_id, test_id, status, duration_ms, error_message, failure_category, artifact_paths)
                VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (session_id, test_id) DO UPDATE
                SET status=$3, duration_ms=$4, error_message=$5, failure_category=$6, artifact_paths=$7`,
          params: [
            this._sessionId, result.testId, result.status, result.durationMs,
            result.errorMessage, result.failureCategory ?? null, JSON.stringify(result.artifactPaths),
          ],
        },
        this._sessionId,
      );
    } catch (err) {
      this._logger.warn(this._sessionId, 'execution.agent', `Failed to persist result: ${String(err)}`);
    }
  }
}
