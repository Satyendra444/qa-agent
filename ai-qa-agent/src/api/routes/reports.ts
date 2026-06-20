import { Router } from 'express';
import type { Request, Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

export function createReportRouter(reportDir: string): Router {
  const router = Router({ mergeParams: true });

  router.get('/', (req: Request, res: Response): void => {
    const { sessionId } = req.params as { sessionId: string };
    const filePath = join(reportDir, `report-${sessionId}.html`);

    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'REPORT_NOT_FOUND', sessionId });
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    createReadStream(filePath).pipe(res);
  });

  return router;
}
