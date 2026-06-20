import { Router } from 'express';
import type { Request, Response } from 'express';
import type { OrchestratorAgent } from '@agents/orchestrator/index.js';

export function createSessionRouter(orchestrator: OrchestratorAgent): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { requirement } = req.body as { requirement?: unknown };

    if (typeof requirement !== 'string' || requirement.trim().length === 0) {
      res.status(400).json({ error: 'INVALID_REQUEST', message: 'requirement must be a non-empty string' });
      return;
    }

    const sessionId = await orchestrator.startSession(requirement.trim());
    res.status(202).json({ sessionId });
  });

  router.get('/:sessionId', async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params as { sessionId: string };
    const session = await orchestrator.getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: 'SESSION_NOT_FOUND', sessionId });
      return;
    }

    res.status(200).json(session);
  });

  router.get('/dashboard/sessions', async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'See task 29.1' });
  });

  router.get('/dashboard/metrics', async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'See task 29.1' });
  });

  return router;
}
