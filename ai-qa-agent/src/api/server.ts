import express from 'express';
import type { OrchestratorAgent } from '@agents/orchestrator/index.js';
import type { ILogger } from '@logging/logger.js';
import { requestLogger } from './middleware/logger.js';
import { globalErrorHandler } from './middleware/error.js';
import { createSessionRouter } from './routes/sessions.js';
import { createReportRouter } from './routes/reports.js';

export function createApp(
  orchestrator: OrchestratorAgent,
  reportDir: string,
  logger: ILogger,
): express.Application {
  const app = express();

  // ── Body parsing ────────────────────────────────────────────────────────
  app.use(express.json());

  // ── Request logging ─────────────────────────────────────────────────────
  app.use(requestLogger(logger));

  // ── Health check (Requirement 2.6 / task 38.2) ─────────────────────────
  // TODO (task 38.2): replace stub with full health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // ── API routes ──────────────────────────────────────────────────────────
  app.use('/api/sessions', createSessionRouter(orchestrator));
  app.use('/api/sessions/:sessionId/report', createReportRouter(reportDir));

  // ── Dashboard (static + data) — wired in task 30.3 ─────────────────────
  // TODO (task 30.3): app.use('/dashboard', dashboardRouter);

  // ── Global error handler (must be last) ────────────────────────────────
  app.use(globalErrorHandler);

  return app;
}
