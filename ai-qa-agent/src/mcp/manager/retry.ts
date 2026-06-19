
/**
 * Executes `fn` and retries up to `maxAttempts` times when `isTransient`
 * returns true for the thrown error.  Non-transient errors are re-thrown
 * immediately.  Delay doubles after each attempt starting at `baseDelayMs`.
 *
 * @param fn          The async operation to attempt.
 * @param maxAttempts Maximum total attempts (default: 3).
 * @param baseDelayMs Delay before the second attempt in ms (default: 1000).
 * @param isTransient Predicate deciding if an error warrants a retry.
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
  isTransient: (err: unknown) => boolean = defaultIsTransient,
): Promise<T> {
  // TODO (task 5.1): implement retry loop with exponential backoff
  throw new Error('withExponentialBackoff() not yet implemented — see task 5.1');
}

/**
 * Default transient-error predicate.
 * Classifies network timeouts, connection resets, and HTTP 503 as transient.
 */
export function defaultIsTransient(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('econnrefused') ||
      msg.includes('socket hang up') ||
      msg.includes('network timeout')
    ) {
      return true;
    }
  }
  // HTTP 503-equivalent — check for a numeric code property
  if (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as Record<string, unknown>)['statusCode'] === 503
  ) {
    return true;
  }
  return false;
}

/** Resolves after `ms` milliseconds — used by the retry loop. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
