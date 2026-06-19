import { Router } from 'express';

export function createReportRouter(reportDir: string): Router {
  const router = Router({ mergeParams: true });
  router.get('/', (req, res) => {
    const { sessionId } = req.params as { sessionId: string };
    res.status(501).json({
      error: 'NOT_IMPLEMENTED',
      message: 'See task 31.4',
      sessionId,
      reportDir,
    });
  });

  return router;
}
