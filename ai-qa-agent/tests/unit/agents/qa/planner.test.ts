import { describe, it, expect } from 'vitest';
import { planActions, buildLoginValidations } from '../../../../src/agents/qa/planner.js';
import type { MCPToolSchema } from '../../../../src/shared/types.js';

const PLAYWRIGHT_TOOLS: MCPToolSchema[] = [
  { name: 'browser_navigate', description: 'Navigate to URL', inputSchema: {} },
  { name: 'browser_screenshot', description: 'Take screenshot', inputSchema: {} },
  { name: 'browser_click', description: 'Click element', inputSchema: {} },
  { name: 'browser_type', description: 'Type text', inputSchema: {} },
  { name: 'browser_evaluate', description: 'Run JS', inputSchema: {} },
  { name: 'browser_get_text', description: 'Get text', inputSchema: {} },
  { name: 'browser_wait_for', description: 'Wait for element', inputSchema: {} },
];

describe('planActions', () => {
  it('includes browser_navigate for navigation tasks', () => {
    const { actions } = planActions('Open https://example.com', PLAYWRIGHT_TOOLS, 'playwright');
    expect(actions.some((a) => a.toolName === 'browser_navigate')).toBe(true);
  });

  it('extracts URL from task', () => {
    const { actions } = planActions('Go to https://myapp.com/login', PLAYWRIGHT_TOOLS, 'playwright');
    const nav = actions.find((a) => a.toolName === 'browser_navigate');
    expect(nav?.input['url']).toBe('https://myapp.com/login');
  });

  it('falls back to example.com when no URL in task', () => {
    const { actions } = planActions('Open a website', PLAYWRIGHT_TOOLS, 'playwright');
    const nav = actions.find((a) => a.toolName === 'browser_navigate');
    expect(nav?.input['url']).toBe('https://example.com');
  });

  it('includes browser_screenshot after navigation', () => {
    const { actions } = planActions('Open https://example.com', PLAYWRIGHT_TOOLS, 'playwright');
    const navIdx = actions.findIndex((a) => a.toolName === 'browser_navigate');
    const ssIdx = actions.findIndex((a) => a.toolName === 'browser_screenshot');
    expect(navIdx).toBeGreaterThanOrEqual(0);
    expect(ssIdx).toBeGreaterThan(navIdx);
  });

  it('includes browser_evaluate for login page validation task', () => {
    const { actions } = planActions(
      'Open https://example.com/login and validate login page',
      PLAYWRIGHT_TOOLS,
      'playwright',
    );
    expect(actions.some((a) => a.toolName === 'browser_evaluate')).toBe(true);
  });

  it('includes browser_get_text for login validation task', () => {
    const { actions } = planActions(
      'Open website and validate login page',
      PLAYWRIGHT_TOOLS,
      'playwright',
    );
    expect(actions.some((a) => a.toolName === 'browser_get_text')).toBe(true);
  });

  it('assigns serverId to all actions', () => {
    const { actions } = planActions('Open https://example.com', PLAYWRIGHT_TOOLS, 'playwright');
    expect(actions.every((a) => a.serverId === 'playwright')).toBe(true);
  });

  it('assigns unique sequential IDs to actions', () => {
    const { actions } = planActions('Open https://example.com validate login', PLAYWRIGHT_TOOLS, 'playwright');
    const ids = actions.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('only plans tools that are available', () => {
    const limitedTools: MCPToolSchema[] = [
      { name: 'browser_navigate', description: 'Navigate', inputSchema: {} },
    ];
    const { actions } = planActions('Open https://example.com validate login', limitedTools, 'playwright');
    expect(actions.every((a) => a.toolName === 'browser_navigate')).toBe(true);
  });

  it('returns reasoning string', () => {
    const { reasoning } = planActions('Open https://example.com', PLAYWRIGHT_TOOLS, 'playwright');
    expect(typeof reasoning).toBe('string');
    expect(reasoning.length).toBeGreaterThan(0);
  });

  it('returns empty actions for empty tool list', () => {
    const { actions } = planActions('Open https://example.com', [], 'playwright');
    expect(actions).toHaveLength(0);
  });
});

describe('buildLoginValidations', () => {
  it('returns checks for login page tasks', () => {
    const checks = buildLoginValidations('Open website and validate login page');
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.some((c) => c.expectedText === 'password')).toBe(true);
  });

  it('returns empty array for non-login tasks', () => {
    const checks = buildLoginValidations('Check the dashboard page');
    expect(checks).toHaveLength(0);
  });

  it('returns checks for "sign in" task', () => {
    const checks = buildLoginValidations('Validate the sign in page');
    expect(checks.length).toBeGreaterThan(0);
  });
});
