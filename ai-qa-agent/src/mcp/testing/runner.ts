import fs from 'node:fs/promises';
import path from 'node:path';
import { ConsoleLogger } from '@logging/logger.js';
import { MCPServerManager } from '@mcp/manager/index.js';
import { MCPTestingFramework } from './index.js';
import { MCPTestReporter } from './report.js';
import type { MCPConnectionConfig } from '@mcp/manager/connection.js';

interface RunnerOptions {
  serverId: string;
  reportDir: string;
  concurrencyLevel: number;
  timeoutMs: number;
}

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};

  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const [key, value] = arg.substring(2).split('=');
    opts[key] = value ?? '';
  }

  return {
    serverId: opts.serverId ?? 'playwright',
    reportDir: opts.reportDir ?? 'reports/mcp-testing',
    concurrencyLevel: Number(opts.concurrencyLevel ?? '3'),
    timeoutMs: Number(opts.timeoutMs ?? '30000'),
  };
}

function getServerConfig(serverId: string): MCPConnectionConfig[] {
  if (serverId === 'playwright') {
    return [
      {
        id: 'playwright',
        transport: 'stdio',
        command: 'npx',
        args: ['@playwright/mcp@latest', '--headless'],
        connectTimeoutMs: 20_000,
      },
    ];
  }

  throw new Error(`Unknown serverId: ${serverId}`);
}

async function ensureDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function main(): Promise<void> {
  const options = parseArgs();
  const logger = new ConsoleLogger();

  logger.info('runner', 'mcp.testing.runner', 'start', {}, { options }, 0);

  const manager = new MCPServerManager(getServerConfig(options.serverId), logger);
  await manager.connect();

  if (!manager.isServerAvailable(options.serverId)) {
    throw new Error(`MCP server '${options.serverId}' is not available`);
  }

  const framework = new MCPTestingFramework(manager, {
    concurrencyLevel: options.concurrencyLevel,
    timeoutMs: options.timeoutMs,
  }, logger);

  const report = await framework.runAllTests(options.serverId);
  const reportDir = path.resolve(process.cwd(), options.reportDir);
  await ensureDirectory(reportDir);

  const jsonPath = path.join(reportDir, `mcp-test-report-${options.serverId}.json`);
  const htmlPath = path.join(reportDir, `mcp-test-report-${options.serverId}.html`);

  await MCPTestReporter.writeJson(jsonPath, report);
  await MCPTestReporter.writeHtml(htmlPath, report);

  logger.info('runner', 'mcp.testing.runner', 'complete', {}, { jsonPath, htmlPath }, 0);
  await manager.disconnect();
}

main().catch((error) => {
  process.stderr.write(`MCP testing runner failed: ${String(error)}\n`);
  process.exit(1);
});
