
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
  isTransient: (err: unknown) => boolean = defaultIsTransient,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransient(err) || attempt === maxAttempts) {
        throw err;
      }
      await delay(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }
  throw lastError;
}

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

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
