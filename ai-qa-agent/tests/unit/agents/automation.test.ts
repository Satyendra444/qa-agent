import { describe, it, expect, vi } from 'vitest';
import { AutomationAgent } from '../../../src/agents/automation/index.js';
import { generatePageObject } from '../../../src/agents/automation/pom-template.js';
import type { ILogger } from '../../../src/logging/logger.js';
import type { MCPServerManager } from '../../../src/mcp/manager/index.js';
import type { TestCase } from '../../../src/shared/types.js';

function makeLogger(): ILogger {
  return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeManager(): MCPServerManager {
  return {
    isServerAvailable: vi.fn().mockReturnValue(false),
    callTool: vi.fn().mockResolvedValue({ result: {} }),
    getAvailableTools: vi.fn().mockReturnValue([]),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MCPServerManager;
}

const TEST_CASES: TestCase[] = [
  {
    id: 'tc-s1-pos-1',
    title: '[Positive] Login page validation',
    type: 'positive',
    preconditions: ['App is running'],
    steps: ['Navigate to the login page', 'Verify email field is visible'],
    expectedResult: 'Login form is visible with all required fields',
  },
  {
    id: 'tc-s1-neg-1',
    title: '[Negative] Login page — invalid input',
    type: 'negative',
    preconditions: ['App is running'],
    steps: ['Navigate to login', 'Submit empty form'],
    expectedResult: 'Validation error is shown',
  },
];

describe('generatePageObject', () => {
  it('generates a TypeScript class with the correct name', () => {
    const src = generatePageObject({ className: 'LoginPage', selectors: {}, actions: [] });
    expect(src).toContain('export class LoginPage');
  });

  it('includes selector properties', () => {
    const src = generatePageObject({
      className: 'LoginPage',
      selectors: { emailInput: '#email', passwordInput: '#password' },
      actions: [],
    });
    expect(src).toContain("emailInput = this.page.locator('#email')");
    expect(src).toContain("passwordInput = this.page.locator('#password')");
  });

  it('includes action methods', () => {
    const src = generatePageObject({
      className: 'LoginPage',
      selectors: {},
      actions: ['click login', 'fill email'],
    });
    expect(src).toContain('async clickLogin()');
    expect(src).toContain('async fillEmail()');
  });

  it('imports Page from playwright', () => {
    const src = generatePageObject({ className: 'TestPage', selectors: {}, actions: [] });
    expect(src).toContain("from '@playwright/test'");
  });
});

describe('AutomationAgent', () => {
  it('returns INVALID_INPUT for empty test cases', async () => {
    const agent = new AutomationAgent(makeManager(), makeLogger(), 's');
    const result = await agent.generate([]);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toBe('INVALID_INPUT');
  });

  it('generates one script path per test case', async () => {
    const agent = new AutomationAgent(makeManager(), makeLogger(), 's');
    const result = await agent.generate(TEST_CASES);
    if ('error' in result) throw new Error('Expected success');
    expect(result.scriptPaths).toHaveLength(TEST_CASES.length);
  });

  it('generates POM class for the page referenced in steps', async () => {
    const agent = new AutomationAgent(makeManager(), makeLogger(), 's');
    const result = await agent.generate(TEST_CASES);
    if ('error' in result) throw new Error('Expected success');
    expect(result.pomPaths.length).toBeGreaterThan(0);
  });

  it('does not generate duplicate POM classes for the same page', async () => {
    const agent = new AutomationAgent(makeManager(), makeLogger(), 's');
    const result = await agent.generate(TEST_CASES);
    if ('error' in result) throw new Error('Expected success');
    expect(new Set(result.pomPaths).size).toBe(result.pomPaths.length);
  });
});
