import { describe, it, expect, vi } from 'vitest';
import { withExponentialBackoff, defaultIsTransient, delay } from '../../../src/mcp/manager/retry.js';

describe('delay', () => {
  it('resolves after approximately the specified ms', async () => {
    const start = Date.now();
    await delay(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe('defaultIsTransient', () => {
  it.each([
    ['ECONNRESET error', new Error('read ECONNRESET')],
    ['etimedout error', new Error('connect ETIMEDOUT')],
    ['econnrefused error', new Error('connect ECONNREFUSED')],
    ['socket hang up', new Error('socket hang up')],
    ['network timeout', new Error('network timeout')],
  ])('returns true for %s', (_label, err) => {
    expect(defaultIsTransient(err)).toBe(true);
  });

  it('returns true for HTTP-503-like objects', () => {
    expect(defaultIsTransient({ statusCode: 503, message: 'Service Unavailable' })).toBe(true);
  });

  it.each([
    ['generic error', new Error('something broke')],
    ['null', null],
    ['string', 'oops'],
    ['404-like object', { statusCode: 404 }],
  ])('returns false for %s', (_label, err) => {
    expect(defaultIsTransient(err)).toBe(false);
  });
});

describe('withExponentialBackoff', () => {
  it('returns immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withExponentialBackoff(fn, 3, 0);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient errors and succeeds on second attempt', async () => {
    const transientErr = new Error('ECONNRESET');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(transientErr)
      .mockResolvedValueOnce('recovered');

    const result = await withExponentialBackoff(fn, 3, 0);
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-transient error without retrying', async () => {
    const permanentErr = new Error('FATAL: invalid input');
    const fn = vi.fn().mockRejectedValue(permanentErr);

    await expect(withExponentialBackoff(fn, 3, 0)).rejects.toThrow('FATAL: invalid input');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts all attempts and throws last error', async () => {
    const err = new Error('ECONNRESET');
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withExponentialBackoff(fn, 3, 0)).rejects.toThrow('ECONNRESET');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls custom isTransient predicate', async () => {
    const isTransient = vi.fn().mockReturnValue(false);
    const fn = vi.fn().mockRejectedValue(new Error('custom'));

    await expect(withExponentialBackoff(fn, 3, 0, isTransient)).rejects.toThrow('custom');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(isTransient).toHaveBeenCalledTimes(1);
  });

  it('doubles delay between attempts', async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((fn: (...args: unknown[]) => void, ms?: number) => {
        delays.push(ms ?? 0);
        return originalSetTimeout(fn, 0);
      });

    const err = new Error('ECONNRESET');
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('ok');

    await withExponentialBackoff(fn, 3, 100);

    setTimeoutSpy.mockRestore();

    // First retry: 100ms, second retry: 200ms
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(200);
  });
});
