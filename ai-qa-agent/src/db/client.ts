

import pg from 'pg';

const { Pool } = pg;

export type QueryResult<T> = pg.QueryResult<T>;

let _pool: pg.Pool | null = null;

export function getPool(connectionString?: string): pg.Pool {
  if (_pool === null) {
    _pool = new Pool({
      connectionString: connectionString ?? process.env['DATABASE_URL'],
      // Sensible defaults — override via DATABASE_URL query-string params if needed
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    _pool.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('[db] Unexpected pool error', err.message);
    });
  }
  return _pool;
}

/**
 * Executes a parameterised SQL query and returns typed rows.
 *
 * @param sql   Parameterised SQL string (use $1, $2, … placeholders)
 * @param params  Query parameters matching the placeholders
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, params);
}

/**
 * Gracefully closes the pool — call on application shutdown.
 */
export async function closePool(): Promise<void> {
  if (_pool !== null) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * Resets the pool singleton — for use in tests only.
 * @internal
 */
export function _resetPoolForTests(): void {
  _pool = null;
}
