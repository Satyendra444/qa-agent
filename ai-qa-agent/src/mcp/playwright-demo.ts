import { ConsoleLogger } from '@logging/logger.js';
import { MCPServerManager } from './manager/index.js';

const SESSION_ID = 'demo-session';

async function main(): Promise<void> {
  const logger = new ConsoleLogger();

  const manager = new MCPServerManager(
    [
      {
        id: 'playwright',
        transport: 'stdio',
        command: 'npx',
        args: ['@playwright/mcp@latest', '--headless'],
        connectTimeoutMs: 15_000,
      },
    ],
    logger,
  );

  logger.info(SESSION_ID, 'demo', 'startup', {}, { message: 'Connecting to Playwright MCP…' }, 0);
  await manager.connect();

  if (!manager.isServerAvailable('playwright')) {
    logger.error(SESSION_ID, 'demo', 'Playwright MCP server is not available — check that npx and @playwright/mcp are installed');
    process.exit(1);
  }

  const tools = manager.getAvailableTools('playwright');
  logger.info(SESSION_ID, 'demo', 'tools.list', {}, { count: tools.length, names: tools.map((t) => t.name) }, 0);

  process.stdout.write('\n=== Available Playwright MCP tools ===\n');
  for (const t of tools) {
    process.stdout.write(`  • ${t.name} — ${t.description}\n`);
  }
  process.stdout.write('\n');

  process.stdout.write('=== Navigating to https://www.notesly.in/ ===\n');
  const navResult = await manager.callTool(
    'playwright',
    'browser_navigate',
    { url: 'https://www.notesly.in/' },
    SESSION_ID,
  );
  logger.info(SESSION_ID, 'demo', 'browser_navigate', { url: 'https://www.notesly.in/' }, { result: navResult.result }, 0);
  process.stdout.write(`Navigation result: ${JSON.stringify(navResult.result, null, 2)}\n\n`);

  process.stdout.write('=== Taking a screenshot ===\n');
  const screenshotResult = await manager.callTool(
    'playwright',
    'browser_screenshot',
    {},
    SESSION_ID,
  );
  logger.info(SESSION_ID, 'demo', 'browser_screenshot', {}, { result: 'captured' }, 0);
  process.stdout.write(`Screenshot captured (data length: ${JSON.stringify(screenshotResult.result).length} chars)\n\n`);

  await manager.disconnect();
  logger.info(SESSION_ID, 'demo', 'shutdown', {}, { message: 'Disconnected cleanly' }, 0);
  process.stdout.write('Demo complete.\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`Demo failed: ${String(err)}\n`);
  process.exit(1);
});
