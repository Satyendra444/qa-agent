import express from 'express';
import type { OrchestratorAgent } from '@agents/orchestrator/index.js';
import type { ILogger } from '@logging/logger.js';
import { requestLogger } from './middleware/logger.js';
import { globalErrorHandler } from './middleware/error.js';
import { createSessionRouter } from './routes/sessions.js';
import { createReportRouter } from './routes/reports.js';
import { createDashboardApiRouter } from './routes/dashboard.js';
import { createDashboardRouter } from '@dashboards/server.js';

export function createApp(
  orchestrator: OrchestratorAgent,
  reportDir: string,
  logger: ILogger,
): express.Application {
  const app = express();

  app.use(express.json());
  app.use(requestLogger(logger));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/sessions', createSessionRouter(orchestrator));
  app.use('/api/sessions/:sessionId/report', createReportRouter(reportDir));
  app.use('/api/dashboard', createDashboardApiRouter());
  app.use('/dashboard', createDashboardRouter());

  app.use(globalErrorHandler);

  return app;
}
