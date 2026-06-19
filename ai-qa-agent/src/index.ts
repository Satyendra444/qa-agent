
import { loadConfig } from '@shared/config.js';
import { ConsoleLogger } from '@logging/logger.js';
import { OrchestratorAgent } from '@agents/orchestrator/index.js';
import { createApp } from '@api/server.js';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Load and validate environment configuration
  const config = loadConfig();
  const logger = new ConsoleLogger();

  // 2. Wire collaborators
  // TODO (phase 3+): build MCPServerManager, SessionStore, and full pipeline graph
  //                  before passing to OrchestratorAgent.
  const sessionStore = {
    // Temporary no-op store — replaced in task 11.2
    async save(): Promise<void> { throw new Error('Session store not implemented yet'); },
    async findById(): Promise<null> { return null; },
    async update(): Promise<void> { throw new Error('Session store not implemented yet'); },
  };

  const orchestrator = new OrchestratorAgent(sessionStore, logger);
  const app = createApp(orchestrator, config.reportDir, logger);

  // 3. Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info('system', 'api', 'server.start', {}, { port: config.port }, 0);
    process.stdout.write(`[server] Listening on http://localhost:${config.port}\n`);
  });

  // 4. Graceful shutdown
  const shutdown = async (): Promise<void> => {
    process.stdout.write('\n[server] Shutting down…\n');
    server.close(() => {
      process.stdout.write('[server] HTTP server closed.\n');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => { void shutdown(); });
  process.on('SIGINT',  () => { void shutdown(); });
}

main().catch((err: unknown) => {
  process.stderr.write(`[server] Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
