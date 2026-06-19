
import type { LogEntry } from '@shared/types.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ILogger {
  /**
   * Emit a structured log entry for any agent action, MCP tool call,
   * LLM API call, or pipeline state transition.
   */
  log(entry: LogEntry): void;

  /** Convenience wrapper — builds and emits a LogEntry from loose parts. */
  info(
    sessionId: string,
    agent: string,
    tool: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    latencyMs: number,
    tokensUsed?: number,
  ): void;

  /** Emit a warning entry (status = "warning"). */
  warn(
    sessionId: string,
    agent: string,
    message: string,
    extra?: Record<string, unknown>,
  ): void;

  /** Emit an error entry (status = "error"). */
  error(
    sessionId: string,
    agent: string,
    message: string,
    errors?: string[],
  ): void;
}

// ---------------------------------------------------------------------------
// Console implementation (used in dev / until persistence is wired)
// ---------------------------------------------------------------------------

export class ConsoleLogger implements ILogger {
  log(entry: LogEntry): void {
    // Emit as a single-line JSON string so structured log processors can parse it.
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  info(
    sessionId: string,
    agent: string,
    tool: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    latencyMs: number,
    tokensUsed = 0,
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      sessionId,
      agent,
      tool,
      input,
      output,
      latency: latencyMs,
      status: 'success',
      tokensUsed,
      errors: [],
    });
  }

  warn(
    sessionId: string,
    agent: string,
    message: string,
    extra: Record<string, unknown> = {},
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      sessionId,
      agent,
      tool: 'logger',
      input: {},
      output: { message, ...extra },
      latency: 0,
      status: 'warning',
      tokensUsed: 0,
      errors: [message],
    });
  }

  error(
    sessionId: string,
    agent: string,
    message: string,
    errors: string[] = [],
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      sessionId,
      agent,
      tool: 'logger',
      input: {},
      output: { message },
      latency: 0,
      status: 'error',
      tokensUsed: 0,
      errors: errors.length > 0 ? errors : [message],
    });
  }
}

/** Singleton console logger — swap out at wiring time for a persisting logger. */
export const defaultLogger: ILogger = new ConsoleLogger();
