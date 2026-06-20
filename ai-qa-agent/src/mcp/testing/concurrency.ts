import type { MCPServerManager } from '@mcp/manager/index.js';

export interface ConcurrencyResult {
  concurrencyLevel: number;
  successful: number;
  timedOut: number;
  failed: number;
  durationMs: number;
}

export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 50;

export class ConcurrencyTester {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _timeoutMs: number = 30_000,
  ) {}

  async run(
    serverId: string,
    toolName: string,
    input: Record<string, unknown>,
    concurrencyLevel: number,
  ): Promise<ConcurrencyResult> {
    if (concurrencyLevel < MIN_CONCURRENCY || concurrencyLevel > MAX_CONCURRENCY) {
      throw new Error(
        `Concurrency level must be between ${MIN_CONCURRENCY} and ${MAX_CONCURRENCY}, got ${concurrencyLevel}`,
      );
    }

    const start = Date.now();
    let successful = 0;
    let timedOut = 0;
    let failed = 0;

    const makeCall = async (): Promise<void> => {
      const callPromise = this._manager.callTool(serverId, toolName, input, 'concurrency-test');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), this._timeoutMs),
      );
      try {
        await Promise.race([callPromise, timeoutPromise]);
        successful++;
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('timeout')) {
          timedOut++;
        } else {
          failed++;
        }
      }
    };

    await Promise.all(
      Array.from({ length: concurrencyLevel }, () => makeCall()),
    );

    return {
      concurrencyLevel,
      successful,
      timedOut,
      failed,
      durationMs: Date.now() - start,
    };
  }
}
