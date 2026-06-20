/**
 * Integration test — requires a real Playwright MCP server.
 * Run: npm run test:integration
 *
 * Prerequisites: npm install && npx playwright install --with-deps chromium
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPServerManager } from '../../../src/mcp/manager/index.js';
import { ConsoleLogger } from '../../../src/logging/logger.js';
import { QAAgent } from '../../../src/agents/qa/index.js';
import { InMemoryAgentMemory } from '../../../src/agents/qa/memory.js';

describe('QAAgent — integration with real Playwright MCP', () => {
  let manager: MCPServerManager;
  let agent: QAAgent;

  beforeAll(async () => {
    manager = new MCPServerManager(
      [
        {
          id: 'playwright',
          transport: 'stdio',
          command: 'npx',
          args: ['@playwright/mcp@latest', '--headless'],
          connectTimeoutMs: 20_000,
        },
      ],
      new ConsoleLogger(),
    );
    await manager.connect();
    agent = new QAAgent(manager, new ConsoleLogger(), { serverId: 'playwright' });
  }, 30_000);

  afterAll(async () => {
    await manager.disconnect();
  });

  it('connects to Playwright MCP server', () => {
    expect(manager.isServerAvailable('playwright')).toBe(true);
  });

  it('returns a report with a valid sessionId', async () => {
    const report = await agent.run('Open https://www.notesly.in/');
    expect(typeof report.sessionId).toBe('string');
    expect(report.sessionId.length).toBeGreaterThan(0);
  }, 30_000);

  it('successfully navigates to example.com', async () => {
    const report = await agent.run('Open https://www.notesly.in/');
    const navAction = report.actions.find((a) => a.toolName === 'browser_navigate');
    expect(navAction).toBeDefined();
    expect(navAction?.status).toBe('success');
  }, 30_000);

  it('validates login page on practicetestautomation', async () => {
    const report = await agent.run(
      'Open https://practicetestautomation.com/practice-test-login/ and validate login page',
    );
    expect(report.status).not.toBe(undefined);
    expect(report.actions.length).toBeGreaterThan(0);

    const navAction = report.actions.find((a) => a.toolName === 'browser_navigate');
    expect(navAction?.status).toBe('success');
  }, 60_000);

  it('stores results in memory after each run', async () => {
    const memory = new InMemoryAgentMemory();
    const agentWithMemory = new QAAgent(manager, new ConsoleLogger(), { serverId: 'playwright' }, memory);

    await agentWithMemory.run('Open https://www.notesly.in/');
    expect(agentWithMemory.memory.size).toBe(1);

    await agentWithMemory.run('Open https://www.notesly.in/ again');
    expect(agentWithMemory.memory.size).toBe(2);
  }, 60_000);

  it('report has all required fields', async () => {
    const report = await agent.run('Open https://www.notesly.in/');
    expect(typeof report.sessionId).toBe('string');
    expect(typeof report.task).toBe('string');
    expect(['passed', 'failed', 'partial']).toContain(report.status);
    expect(typeof report.startedAt).toBe('string');
    expect(typeof report.completedAt).toBe('string');
    expect(typeof report.durationMs).toBe('number');
    expect(Array.isArray(report.actions)).toBe(true);
    expect(Array.isArray(report.validations)).toBe(true);
    expect(typeof report.summary).toBe('string');
    expect(Array.isArray(report.errors)).toBe(true);
  }, 30_000);
});
