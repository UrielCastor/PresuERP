import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Something went wrong';
  let errors: any = null;

  if (err instanceof AppError || (err && typeof (err as any).statusCode === 'number')) {
    statusCode = (err as any).statusCode || 500;
    message = err.message;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Access token has expired';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  }

  // Log only critical server errors as error level, operational as warn/info
  if (statusCode === 500) {
    logger.error(`[Unhandled Error] ${err.stack || err.message}`);
  } else {
    logger.warn(`[Client Error] ${statusCode} - ${err.message} - ${req.originalUrl}`);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(errors && { errors }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
