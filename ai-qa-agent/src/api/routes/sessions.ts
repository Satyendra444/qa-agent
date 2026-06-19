import { Router } from 'express';
import type { OrchestratorAgent } from '@agents/orchestrator/index.js';

export function createSessionRouter(orchestrator: OrchestratorAgent): Router {
  const router = Router();

  // ── POST /api/sessions ────────────────────────────────────────────────────
  // TODO (task 12.2): validate body, call orchestrator.startSession(), return 202 { sessionId }
  router.post('/', (_req, res) => {
    res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'See task 12.2' });
  });

  // ── GET /api/sessions/:sessionId ──────────────────────────────────────────
  // TODO (task 12.2): call orchestrator.getSession(); return 404 for unknown ids
  router.get('/:sessionId', (_req, res) => {
    res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'See task 12.2' });
  });

  // ── GET /api/dashboard/sessions ───────────────────────────────────────────
  // TODO (task 29.1): return all sessions sorted by startedAt desc
  router.get('/dashboard/sessions', (_req, res) => {
    res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'See task 29.1' });
  });

  // ── GET /api/dashboard/metrics ────────────────────────────────────────────
  // TODO (task 29.1): return time-series + rolling-average metric data
  router.get('/dashboard/metrics', (_req, res) => {
    res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'See task 29.1' });
  });

  return router;
}
