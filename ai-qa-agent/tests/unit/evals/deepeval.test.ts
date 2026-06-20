import { describe, it, expect } from 'vitest';
import { DeepEvalAdapter } from '../../../src/evals/deepeval.js';

describe('DeepEvalAdapter', () => {
  const adapter = new DeepEvalAdapter(0.5);

  it('returns similarity 1.0 for identical strings', async () => {
    const result = await adapter.evaluate('login page test', 'login page test', 0.5);
    expect(result.similarity).toBe(1.0);
    expect(result.passed).toBe(true);
  });

  it('returns similarity 0 for completely different strings', async () => {
    const result = await adapter.evaluate('apple orange banana', 'quantum physics calculus', 0.5);
    expect(result.similarity).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('returns passed=true when similarity meets threshold', async () => {
    const result = await adapter.evaluate(
      'validate the login form with username and password fields',
      'check login page has username password and submit button',
      0.3,
    );
    expect(result.passed).toBe(true);
    expect(result.similarity).toBeGreaterThan(0.3);
  });

  it('returns passed=false when similarity is below threshold', async () => {
    const result = await adapter.evaluate('xyz abc', 'login page', 0.9);
    expect(result.passed).toBe(false);
  });

  it('includes a reason string', async () => {
    const result = await adapter.evaluate('test content', 'test content', 0.5);
    expect(typeof result.reason).toBe('string');
    expect(result.reason!.length).toBeGreaterThan(0);
  });

  it('uses default threshold when not provided', async () => {
    const adapterDefault = new DeepEvalAdapter(0.99);
    const result = await adapterDefault.evaluate('completely different text here', 'login page validation test', undefined as unknown as number);
    expect(result.passed).toBe(false);
  });
});
