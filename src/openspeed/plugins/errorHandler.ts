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
  exposeStack?: boolean; // WARNING: Never set to true in production!
  includeDetails?: boolean;
  transformError?: (error: Error, ctx: Context) => any;
  logErrors?: boolean;
  developmentMode?: boolean;
  customErrorPages?: boolean;
  suggestions?: boolean;
}

export function errorHandler(options: ErrorHandlerOptions = {}) {
  const {
    exposeStack = false, // Never expose stack traces in production!
    includeDetails = process.env.NODE_ENV !== 'production',
    transformError,
    logErrors = true,
    developmentMode = process.env.NODE_ENV === 'development',
    customErrorPages = true,
    suggestions = true,
  } = options;

  // Warn about security risk
  if (exposeStack && process.env.NODE_ENV === 'production') {
    console.warn(
      '[SECURITY WARNING] exposeStack is enabled in production! This may leak sensitive information.'
    );
  }

  return async (ctx: Context, next: () => Promise<any>) => {
    try {
      await next();
    } catch (error: any) {
      if (logErrors) {
        logEnhancedError(error, ctx);
      }

      let status = 500;
      let message = 'Internal Server Error';
      let code: string | undefined;
      let details: unknown;
      let errorSuggestions: string[] = [];

      if (error instanceof HttpError) {
        status = error.status;
        message = error.message;
        code = error.code;
        details = error.details;
      } else {
        // Enhanced error categorization
        const categorized = categorizeError(error);
        status = categorized.status;
        message = categorized.message;
        code = categorized.code;
        errorSuggestions = categorized.suggestions || [];
      }

      // Determine response format
      const isApiRequest = ctx.req.headers.accept?.includes('application/json') ||
                          ctx.req.url.startsWith('/api/') ||
                          ctx.req.headers['content-type']?.includes('application/json');

      if (isApiRequest) {
        // JSON API response
        const errorResponse = {
          success: false,
          error: {
            message,
            status,
            ...(code && { code }),
            ...(includeDetails && details && { details }),
            ...(suggestions && errorSuggestions.length > 0 && developmentMode && { suggestions: errorSuggestions }),
            ...(exposeStack && error.stack && developmentMode && { stack: error.stack }),
          },
        };

        const finalResponse = transformError ? transformError(error, ctx) : errorResponse;

        ctx.res.status = status;
        ctx.res.headers = {
          ...ctx.res.headers,
          'Content-Type': 'application/json',
        };
        ctx.res.body = JSON.stringify(finalResponse);
      } else if (customErrorPages) {
        // HTML error page
        ctx.res.status = status;
        ctx.res.headers = {
          ...ctx.res.headers,
          'Content-Type': 'text/html',
        };
        ctx.res.body = createErrorPage({
          message,
          status,
          code,
          suggestions: suggestions && developmentMode ? errorSuggestions : undefined,
          stack: exposeStack && developmentMode ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
      } else {
        // Plain text fallback
        ctx.res.status = status;
        ctx.res.headers = {
          ...ctx.res.headers,
          'Content-Type': 'text/plain',
        };
        ctx.res.body = `${status} ${message}`;
      }
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

export function internalServerError(message?: string, code?: string, details?: unknown) {
  throw new InternalServerError(message, code, details);
}

// Enhanced error logging
function logEnhancedError(error: Error, ctx: Context) {
  const timestamp = new Date().toISOString();
  const level = error instanceof HttpError && error.status >= 500 ? 'ERROR' : 'WARN';

  console.error(`[${level}] ${timestamp} ${error.message}`);
  console.error(`  URL: ${ctx.req.method} ${ctx.req.url}`);
  console.error(`  User-Agent: ${ctx.req.headers['user-agent'] || 'Unknown'}`);

  if (error.stack && process.env.NODE_ENV === 'development') {
    console.error('  Stack:', error.stack);
  }
}

// Error categorization with suggestions
function categorizeError(error: Error): {
  message: string;
  status: number;
  code?: string;
  suggestions?: string[];
} {
  const errorMessage = error.message || 'Unknown error';

  // Database connection errors
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection refused')) {
    return {
      message: 'Database connection failed',
      status: 503,
      code: 'DATABASE_CONNECTION_ERROR',
      suggestions: [
        'Check if database server is running',
        'Verify connection string in environment variables',
        'Ensure database credentials are correct'
      ]
    };
  }

  // Authentication errors
  if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token')) {
    return {
      message: 'Authentication required',
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
      suggestions: [
        'Provide valid authentication token',
        'Check token expiration',
        'Verify token format and signing'
      ]
    };
  }

  // Validation errors
  if (errorMessage.includes('validation') || error.name === 'ValidationError') {
    return {
      message: 'Invalid request data',
      status: 400,
      code: 'VALIDATION_ERROR',
      suggestions: [
        'Check request format and required fields',
        'Validate data types and constraints',
        'Review API documentation'
      ]
    };
  }

  // File upload errors
  if (errorMessage.includes('file') || errorMessage.includes('upload')) {
    return {
      message: 'File upload failed',
      status: 400,
      code: 'UPLOAD_ERROR',
      suggestions: [
        'Check file size limits',
        'Verify supported file types',
        'Ensure file is not corrupted'
      ]
    };
  }

  // Default server error
  return {
    message: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error',
    status: 500,
    code: 'INTERNAL_ERROR',
    suggestions: process.env.NODE_ENV === 'development' ? [
      'Check server logs for more details',
      'Verify all dependencies are installed',
      'Check environment configuration'
    ] : undefined
  };
}

// Create beautiful HTML error page
function createErrorPage(details: {
  message: string;
  status: number;
  code?: string;
  suggestions?: string[];
  stack?: string;
  timestamp: string;
}): string {
  const isDev = process.env.NODE_ENV === 'development';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error ${details.status} - OpenSpeed</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
        }
        .error-container {
            max-width: 600px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px; padding: 40px; text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        .error-code { font-size: 6rem; font-weight: bold; margin-bottom: 20px; opacity: 0.8; }
        .error-message { font-size: 1.5rem; margin-bottom: 20px; font-weight: 300; }
        .suggestions { background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left; }
        .suggestions ul { list-style: none; padding: 0; }
        .suggestions li { margin-bottom: 8px; padding-left: 20px; position: relative; }
        .suggestions li:before { content: "💡"; position: absolute; left: 0; }
        .back-button {
            display: inline-block; background: white; color: #667eea; padding: 12px 24px;
            text-decoration: none; border-radius: 8px; font-weight: 600; transition: all 0.3s;
        }
        .back-button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1); }
        ${isDev && details.stack ? `
        .debug-info { background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3);
                      border-radius: 8px; padding: 20px; margin-top: 30px; text-align: left;
                      font-family: 'Monaco', 'Menlo', monospace; font-size: 0.8rem; }
        .stack-trace { background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 4px;
                       overflow-x: auto; white-space: pre-wrap; font-size: 0.7rem; line-height: 1.4; }
        ` : ''}
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-code">${details.status}</div>
        <div class="error-message">${details.message}</div>

        ${details.suggestions && details.suggestions.length > 0 ? `
        <div class="suggestions">
            <h3>What you can try:</h3>
            <ul>
                ${details.suggestions.map(s => `<li>${s}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <a href="/" class="back-button">← Go Back Home</a>

        ${isDev && details.stack ? `
        <div class="debug-info">
            <h3>Debug Information (Development Mode)</h3>
            <div class="stack-trace">${details.stack}</div>
        </div>
        ` : ''}
    </div>
</body>
</html>`;
}
