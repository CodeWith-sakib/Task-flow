import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  console.log(`${req.method} ${req.path}`);
  next();
}
