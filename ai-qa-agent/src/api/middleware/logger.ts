import type { Request, Response, NextFunction } from 'express';
import type { ILogger } from '@logging/logger.js';

export function requestLogger(logger: ILogger): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const latency = Date.now() - start;
      logger.info(
        req.headers['x-session-id'] as string ?? 'http',
        'api',
        `${req.method} ${req.path}`,
        { method: req.method, path: req.path, query: req.query },
        { statusCode: res.statusCode },
        latency,
      );
    });

    next();
  };
}
