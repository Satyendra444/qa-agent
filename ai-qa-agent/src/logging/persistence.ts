
import type { LogEntry } from '@shared/types.js';
import type { ILogger } from './logger.js';

export interface ILogPersistence {
  /** Write a log entry to PostgreSQL.  Buffers on failure and retries. */
  persist(entry: LogEntry): Promise<void>;
  /** Flush all buffered entries.  Call on graceful shutdown. */
  flush(): Promise<void>;
  /** Purge entries older than LOG_RETENTION_DAYS (no-op if not configured). */
  purgeExpired(): Promise<void>;
}

/**
 * Stub implementation — replace with full PostgreSQL writer in task 9.3.
 */
export class LogPersistence implements ILogPersistence {
  // In-memory buffer — maximum 1000 entries (Requirement 12.5)
  private readonly _buffer: LogEntry[] = [];
  private readonly _maxBuffer = 1000;

  constructor(
    private readonly _logger: ILogger,
    private readonly _logRetentionDays: number | undefined,
  ) {}

  async persist(_entry: LogEntry): Promise<void> {
    // TODO (task 9.3): write to agent_logs table; buffer on failure; retry every 5 s up to 3 times
    throw new Error('LogPersistence.persist() not yet implemented — see task 9.3');
  }

  async flush(): Promise<void> {
    // TODO (task 9.3): drain _buffer, writing remaining entries to PostgreSQL
    throw new Error('LogPersistence.flush() not yet implemented — see task 9.3');
  }

  async purgeExpired(): Promise<void> {
    // TODO (task 9.3): DELETE FROM agent_logs WHERE timestamp < NOW() - INTERVAL
    throw new Error('LogPersistence.purgeExpired() not yet implemented — see task 9.3');
  }

  /** Exposes buffer length for tests. @internal */
  get bufferLength(): number {
    return this._buffer.length;
  }
}
