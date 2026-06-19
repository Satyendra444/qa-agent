
import type { MCPServerManager } from '../manager/index.js';

export interface ConcurrencyResult {
  concurrencyLevel: number;
  successful: number;
  timedOut: number;
  failed: number;
  durationMs: number;
}

/** Valid concurrency range — requirement 10.5. */
export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 50;

export class ConcurrencyTester {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _timeoutMs: number = 30_000,
  ) {}

  /**
   * Executes `concurrencyLevel` parallel calls to `toolName` on `serverId`.
   *
   * @throws {Error} If `concurrencyLevel` is outside the range 1–50.
   * TODO (task 23.1): implement parallel call execution and timeout tracking.
   */
  async run(
    _serverId: string,
    _toolName: string,
    _input: Record<string, unknown>,
    _concurrencyLevel: number,
  ): Promise<ConcurrencyResult> {
    throw new Error('ConcurrencyTester.run() not yet implemented — see task 23.1');
  }
}
