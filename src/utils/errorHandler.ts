import { Request, Response, NextFunction } from 'express';
import logger from './logger';
import { ValidationError } from './validation';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  requestId?: string;
}

export class ErrorHandler {
  /**
   * Express error handling middleware
   */
  static handleError(error: Error, req: Request, res: Response, _next: NextFunction): void {
    const requestId = req.headers['x-request-id'] as string || this.generateRequestId();
    
    // Log the error
    logger.error({
      error: error.message,
      stack: error.stack,
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }, 'Request error occurred');

    // Determine status code and message
    let statusCode = 500;
    let message = 'Internal Server Error';

    if (error instanceof ValidationError) {
      statusCode = 400;
      message = error.message;
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      message = 'Unauthorized';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      message = 'Forbidden';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      message = 'Not Found';
    } else if (error.name === 'ConflictError') {
      statusCode = 409;
      message = 'Conflict';
    }

    // Create error response
    const errorResponse: ErrorResponse = {
      error: error.name || 'Error',
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId
    };

    // Send response
    res.status(statusCode).json(errorResponse);
  }

  /**
   * Handle 404 errors
   */
  static handleNotFound(_req: Request, _res: Response, next: NextFunction): void {
    const error = new Error('Not Found');
    (error as any).name = 'NotFoundError';
    next(error);
  }

  /**
   * Handle async route errors
   */
  static wrapAsync(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Generate a unique request ID
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create custom error classes
   */
  static createError(name: string, message: string, statusCode: number = 500): Error {
    const error = new Error(message);
    (error as any).name = name;
    (error as any).statusCode = statusCode;
    return error;
  }

  /**
   * Handle uncaught exceptions
   */
  static handleUncaughtException(): void {
    process.on('uncaughtException', (error: Error) => {
      logger.fatal({
        error: error.message,
        stack: error.stack
      }, 'Uncaught Exception - Application will exit');
      
      // Give time for logs to be written
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }

  /**
   * Handle unhandled promise rejections
   */
  static handleUnhandledRejection(): void {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.fatal({
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString()
      }, 'Unhandled Promise Rejection - Application will exit');
      
      // Give time for logs to be written
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }

  /**
   * Setup global error handlers
   */
  static setupGlobalHandlers(): void {
    this.handleUncaughtException();
    this.handleUnhandledRejection();
  }
}

// Custom error classes
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}