
import type { Request, Response, NextFunction } from 'express';

export interface HttpError extends Error {
  statusCode?: number;
  status?: number;
}

export function globalErrorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? err.status ?? 500;
  const message =
    process.env['NODE_ENV'] === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    error: err.name ?? 'Error',
    message,
    statusCode,
  });
}
