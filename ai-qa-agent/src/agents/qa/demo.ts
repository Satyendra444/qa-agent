import { ConsoleLogger } from '@logging/logger.js';
import { MCPServerManager } from '@mcp/manager/index.js';
import { QAAgent } from './index.js';

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

  process.stdout.write('Connecting to Playwright MCP server...\n');
  await manager.connect();

  if (!manager.isServerAvailable('playwright')) {
    process.stderr.write('Playwright MCP server is not available. Run: npm install && npx playwright install\n');
    process.exit(1);
  }

  const agent = new QAAgent(manager, logger, { serverId: 'playwright' });

  const task = 'Open https://practicetestautomation.com/practice-test-login/ and validate login page';

  process.stdout.write(`\nRunning QA Agent\nTask: ${task}\n${'─'.repeat(60)}\n\n`);

  const report = await agent.run(task);

  process.stdout.write('\n' + '─'.repeat(60) + '\n');
  process.stdout.write('EXECUTION REPORT\n');
  process.stdout.write('─'.repeat(60) + '\n');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.stdout.write('─'.repeat(60) + '\n');
  process.stdout.write(`Status : ${report.status.toUpperCase()}\n`);
  process.stdout.write(`Summary: ${report.summary}\n`);
  process.stdout.write(`Duration: ${report.durationMs}ms\n`);

  if (report.validations.length > 0) {
    process.stdout.write('\nValidations:\n');
    for (const v of report.validations) {
      process.stdout.write(`  ${v.passed ? '✅' : '❌'} ${v.name}\n`);
    }
  }

  await manager.disconnect();
  process.exit(report.status === 'failed' ? 1 : 0);
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(1);
});
