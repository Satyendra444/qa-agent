import type { LogEntry } from '@shared/types.js';
import type { ILogger } from './logger.js';
import type { Pool } from 'pg';

export interface ILogPersistence {
  persist(entry: LogEntry): Promise<void>;
  flush(): Promise<void>;
  purgeExpired(): Promise<void>;
}

export class LogPersistence implements ILogPersistence {
  private readonly _buffer: LogEntry[] = [];
  private readonly _maxBuffer = 1000;
  private readonly _maxRetries = 3;
  private readonly _retryIntervalMs = 5_000;

  constructor(
    private readonly _pool: Pool,
    private readonly _logger: ILogger,
    private readonly _logRetentionDays: number | undefined,
  ) {}

  async persist(entry: LogEntry): Promise<void> {
    let attempts = 0;

    const tryWrite = async (): Promise<void> => {
      await this._pool.query(
        `INSERT INTO agent_logs
           (timestamp, session_id, agent, tool, input, output, latency, status, tokens, cost, errors)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          entry.timestamp,
          entry.sessionId,
          entry.agent,
          entry.tool,
          JSON.stringify(entry.input),
          JSON.stringify(entry.output),
          entry.latency,
          entry.status,
          entry.tokens,
          entry.cost,
          JSON.stringify(entry.errors),
        ],
      );
    };

    while (attempts < this._maxRetries) {
      try {
        await tryWrite();
        return;
      } catch {
        attempts++;
        if (attempts >= this._maxRetries) {
          if (this._buffer.length < this._maxBuffer) {
            this._buffer.push(entry);
          }
          this._logger.warn(entry.sessionId, 'log.persistence', 'Log write failed after 3 retries — entry discarded or buffered');
          return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, this._retryIntervalMs));
      }
    }
  }

  async flush(): Promise<void> {
    const entries = this._buffer.splice(0);
    for (const entry of entries) {
      try {
        await this._pool.query(
          `INSERT INTO agent_logs
             (timestamp, session_id, agent, tool, input, output, latency, status, tokens, cost, errors)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT DO NOTHING`,
          [
            entry.timestamp, entry.sessionId, entry.agent, entry.tool,
            JSON.stringify(entry.input), JSON.stringify(entry.output),
            entry.latency, entry.status, entry.tokens, entry.cost, JSON.stringify(entry.errors),
          ],
        );
      } catch {
        this._logger.warn(entry.sessionId, 'log.persistence', 'Flush write failed — entry dropped');
      }
    }
  }

  async purgeExpired(): Promise<void> {
    if (this._logRetentionDays === undefined) return;
    await this._pool.query(
      `DELETE FROM agent_logs WHERE timestamp < NOW() - ($1 || ' days')::INTERVAL`,
      [String(this._logRetentionDays)],
    );
  }

  get bufferLength(): number {
    return this._buffer.length;
  }
}
