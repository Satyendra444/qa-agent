import { describe, it, expect } from 'vitest';
import { runTextValidations, runStructuralValidation } from '../../../../src/agents/qa/validator.js';
import type { ActionResult } from '../../../../src/agents/qa/types.js';

function makeResult(overrides: Partial<ActionResult> = {}): ActionResult {
  return {
    actionId: 'a1',
    toolName: 'browser_get_text',
    input: {},
    output: { content: [{ type: 'text', text: 'Login password submit forgot password' }] },
    status: 'success',
    latencyMs: 50,
    attempt: 1,
    ...overrides,
  };
}

describe('runTextValidations', () => {
  it('marks check as passed when expectedText found in output', () => {
    const results = [makeResult()];
    const specs = [{ name: 'Has password field', expectedText: 'password' }];
    const checks = runTextValidations(specs, results);
    expect(checks[0]?.passed).toBe(true);
  });

  it('marks check as failed when expectedText not found', () => {
    const results = [makeResult({ output: { content: [{ type: 'text', text: 'Welcome home' }] } })];
    const specs = [{ name: 'Has login button', expectedText: 'login' }];
    const checks = runTextValidations(specs, results);
    expect(checks[0]?.passed).toBe(false);
    expect(checks[0]?.error).toContain('Expected to find');
  });

  it('handles plain string output', () => {
    const results = [makeResult({ output: 'Login page with email and password' })];
    const checks = runTextValidations([{ name: 'Has email', expectedText: 'email' }], results);
    expect(checks[0]?.passed).toBe(true);
  });

  it('handles text property output', () => {
    const results = [makeResult({ output: { text: 'Sign in with your account' } })];
    const checks = runTextValidations([{ name: 'Has sign in', expectedText: 'sign in' }], results);
    expect(checks[0]?.passed).toBe(true);
  });

  it('ignores failed action results', () => {
    const results = [makeResult({ status: 'failure', output: 'login password' })];
    const checks = runTextValidations([{ name: 'Has login', expectedText: 'login' }], results);
    expect(checks[0]?.passed).toBe(false);
  });

  it('returns empty array for empty specs', () => {
    expect(runTextValidations([], [makeResult()])).toHaveLength(0);
  });

  it('combines text from multiple results', () => {
    const results = [
      makeResult({ output: 'email username' }),
      makeResult({ output: 'password submit' }),
    ];
    const checks = runTextValidations(
      [{ name: 'has email', expectedText: 'email' }, { name: 'has password', expectedText: 'password' }],
      results,
    );
    expect(checks[0]?.passed).toBe(true);
    expect(checks[1]?.passed).toBe(true);
  });
});

describe('runStructuralValidation', () => {
  const validEvalOutput = JSON.stringify({
    hasEmailOrUsername: true,
    hasPassword: true,
    hasSubmitButton: true,
    pageTitle: 'Login',
    url: 'https://example.com/login',
  });

  it('returns structural checks from browser_evaluate result', () => {
    const results = [
      makeResult({
        toolName: 'browser_evaluate',
        output: { content: [{ type: 'text', text: validEvalOutput }] },
      }),
    ];
    const checks = runStructuralValidation(results);
    expect(checks.length).toBeGreaterThan(0);
  });

  it('marks hasEmailOrUsername as passed when true', () => {
    const results = [
      makeResult({
        toolName: 'browser_evaluate',
        output: { content: [{ type: 'text', text: validEvalOutput }] },
      }),
    ];
    const checks = runStructuralValidation(results);
    const emailCheck = checks.find((c) => c.name.includes('email'));
    expect(emailCheck?.passed).toBe(true);
  });

  it('marks hasPassword as failed when false', () => {
    const output = JSON.stringify({
      hasEmailOrUsername: true,
      hasPassword: false,
      hasSubmitButton: true,
      pageTitle: 'Login',
      url: 'https://example.com',
    });
    const results = [
      makeResult({
        toolName: 'browser_evaluate',
        output: { content: [{ type: 'text', text: output }] },
      }),
    ];
    const checks = runStructuralValidation(results);
    const pwCheck = checks.find((c) => c.name.includes('password'));
    expect(pwCheck?.passed).toBe(false);
  });

  it('returns empty array when no evaluate result exists', () => {
    const results = [makeResult({ toolName: 'browser_navigate' })];
    expect(runStructuralValidation(results)).toHaveLength(0);
  });

  it('returns empty array when evaluate result is failed', () => {
    const results = [
      makeResult({ toolName: 'browser_evaluate', status: 'failure' }),
    ];
    expect(runStructuralValidation(results)).toHaveLength(0);
  });
});
