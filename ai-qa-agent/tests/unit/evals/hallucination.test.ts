import { describe, it, expect } from 'vitest';
import { HallucinationDetector } from '../../../src/evals/hallucination.js';

describe('HallucinationDetector', () => {
  const detector = new HallucinationDetector();

  it('returns empty array when output matches requirement exactly', () => {
    const flags = detector.detect(
      'Navigate to the login page and enter credentials',
      'Navigate to the login page and enter credentials',
    );
    expect(flags).toHaveLength(0);
  });

  it('flags URLs in output not present in requirement', () => {
    const flags = detector.detect(
      'Click the button at https://secret-internal.example.com/admin',
      'Click the submit button on the login page',
    );
    const urlFlag = flags.find((f) => f.content.includes('secret-internal'));
    expect(urlFlag).toBeDefined();
    expect(urlFlag?.reason).toContain('URL');
  });

  it('does not flag URLs that appear in both output and requirement', () => {
    const url = 'https://www.notesly.in/login';
    const flags = detector.detect(
      `Navigate to ${url} and click submit`,
      `Open ${url} and validate the login page`,
    );
    expect(flags.some((f) => f.content === url)).toBe(false);
  });

  it('flags API endpoints in output not in requirement', () => {
    const flags = detector.detect(
      'Call /api/users/delete to remove the account',
      'Log in with email and password on the login page',
    );
    const epFlag = flags.find((f) => f.content.includes('/api/users'));
    expect(epFlag).toBeDefined();
  });

  it('returns empty array for plain text with no suspicious patterns', () => {
    const flags = detector.detect(
      'Enter username and password then click submit',
      'User enters username and password then clicks the submit button',
    );
    expect(flags).toHaveLength(0);
  });
});
