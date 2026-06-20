import type { LogEntry } from '@shared/types.js';

export interface ILogger {
  log(entry: LogEntry): void;
  info(
    sessionId: string,
    agent: string,
    tool: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    latencyMs: number,
    tokensUsed?: number,
  ): void;
  warn(sessionId: string, agent: string, message: string, extra?: Record<string, unknown>): void;
  error(sessionId: string, agent: string, message: string, errors?: string[]): void;
}

export class ConsoleLogger implements ILogger {
  log(entry: LogEntry): void {
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

export const defaultLogger: ILogger = new ConsoleLogger();
