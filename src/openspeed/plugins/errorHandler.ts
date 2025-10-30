import type { Context } from '../context.js';

export class HttpError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(status: number, message: string, code?: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'HttpError';
  }
}

// Predefined error classes
export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', code?: string, details?: any) {
    super(400, message, code, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', code?: string, details?: any) {
    super(401, message, code, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', code?: string, details?: any) {
    super(403, message, code, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', code?: string, details?: any) {
    super(404, message, code, details);
    this.name = 'NotFoundError';
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(message = 'Method Not Allowed', code?: string, details?: any) {
    super(405, message, code, details);
    this.name = 'MethodNotAllowedError';
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', code?: string, details?: any) {
    super(409, message, code, details);
    this.name = 'ConflictError';
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable Entity', code?: string, details?: any) {
    super(422, message, code, details);
    this.name = 'UnprocessableEntityError';
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', code?: string, details?: any) {
    super(500, message, code, details);
    this.name = 'InternalServerError';
  }
}

export class NotImplementedError extends HttpError {
  constructor(message = 'Not Implemented', code?: string, details?: any) {
    super(501, message, code, details);
    this.name = 'NotImplementedError';
  }
}

export class BadGatewayError extends HttpError {
  constructor(message = 'Bad Gateway', code?: string, details?: any) {
    super(502, message, code, details);
    this.name = 'BadGatewayError';
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = 'Service Unavailable', code?: string, details?: any) {
    super(503, message, code, details);
    this.name = 'ServiceUnavailableError';
  }
}

// Error handler middleware
export interface ErrorHandlerOptions {
  exposeStack?: boolean;
  includeDetails?: boolean;
  transformError?: (error: Error, ctx: Context) => any;
  logErrors?: boolean;
}

export function errorHandler(options: ErrorHandlerOptions = {}) {
  const {
    exposeStack = false,
    includeDetails = true,
    transformError,
    logErrors = true
  } = options;

  return async (ctx: Context, next: () => Promise<any>) => {
    try {
      await next();
    } catch (error: any) {
      if (logErrors) {
        console.error('[OpenSpeed Error]', error);
      }

      let status = 500;
      let message = 'Internal Server Error';
      let code: string | undefined;
      let details: any;

      if (error instanceof HttpError) {
        status = error.status;
        message = error.message;
        code = error.code;
        details = error.details;
      } else if (error.name === 'ValidationError') {
        status = 422;
        message = 'Validation failed';
        details = error.details || error.errors;
      } else if (error.name === 'CastError') {
        status = 400;
        message = 'Invalid data format';
      }

      const errorResponse: any = {
        error: {
          message,
          status,
          ...(code && { code }),
          ...(includeDetails && details && { details }),
          ...(exposeStack && error.stack && { stack: error.stack })
        }
      };

      // Allow custom error transformation
      const finalResponse = transformError
        ? transformError(error, ctx)
        : errorResponse;

      ctx.res.status = status;
      ctx.res.headers = {
        ...ctx.res.headers,
        'Content-Type': 'application/json'
      };
      ctx.res.body = JSON.stringify(finalResponse);
    }
  };
}

// Helper functions for throwing errors
export function badRequest(message?: string, code?: string, details?: any) {
  throw new BadRequestError(message, code, details);
}

export function unauthorized(message?: string, code?: string, details?: any) {
  throw new UnauthorizedError(message, code, details);
}

export function forbidden(message?: string, code?: string, details?: any) {
  throw new ForbiddenError(message, code, details);
}

export function notFound(message?: string, code?: string, details?: any) {
  throw new NotFoundError(message, code, details);
}

export function methodNotAllowed(message?: string, code?: string, details?: any) {
  throw new MethodNotAllowedError(message, code, details);
}

export function conflict(message?: string, code?: string, details?: any) {
  throw new ConflictError(message, code, details);
}

export function unprocessableEntity(message?: string, code?: string, details?: any) {
  throw new UnprocessableEntityError(message, code, details);
}

export function internalServerError(message?: string, code?: string, details?: any) {
  throw new InternalServerError(message, code, details);
}