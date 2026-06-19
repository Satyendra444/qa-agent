import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createDashboardRouter(): Router {
  const router = Router();

  router.use(
    '/public',
    (_req, _res, next) => {
      // TODO (task 30.3): wire express.static(path.join(__dirname, 'public'))
      next();
    },
  );

  // SPA shell
  router.get('/', (_req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, (err?: Error) => {
      if (err) {
        res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'See task 30.3' });
      }
    });
  });

  return router;
}
