---
layout: default
title: ErrorHandler
parent: Plugins
nav_order: 4
---

# Error Handler Plugin

The error handler plugin provides comprehensive error management with typed exceptions and automatic error response formatting.

## Installation

```typescript
import { errorHandler, HttpError } from 'openspeed-framework/plugins/errorHandler';

const app = createApp();
app.use(errorHandler());
```

## Basic Usage

### Throwing HTTP Errors

```typescript
app.get('/api/user/:id', (ctx) => {
  const userId = ctx.params.id;

  if (!userId) {
    throw new HttpError(400, 'User ID is required');
  }

  const user = findUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return ctx.json(user);
});
```

### Automatic Error Responses

```typescript
// Errors are automatically caught and formatted
app.get('/api/fail', (ctx) => {
  throw new HttpError(500, 'Something went wrong');
});

// Response:
// {
//   "error": {
//     "status": 500,
//     "message": "Something went wrong"
//   }
// }
```

## HttpError Class

### Constructor

```typescript
new HttpError(status: number, message: string, details?: any)
```

### Properties

```typescript
class HttpError extends Error {
  status: number;      // HTTP status code
  message: string;     // Error message
  details?: any;       // Additional error details
}
```

### Examples

```typescript
// Basic error
throw new HttpError(400, 'Invalid input');

// Error with details
throw new HttpError(422, 'Validation failed', {
  field: 'email',
  reason: 'Invalid email format'
});

// Not found
throw new HttpError(404, 'Resource not found');
```

## Error Response Format

By default, errors are returned as JSON:

```json
{
  "error": {
    "status": 400,
    "message": "Bad Request",
    "details": {
      "field": "username",
      "reason": "Required field"
    }
  }
}
```

## Custom Error Handling

### Custom Error Response Format

```typescript
app.use(errorHandler({
  formatError: (error: HttpError) => {
    return {
      success: false,
      code: error.status,
      message: error.message,
      timestamp: new Date().toISOString(),
      ...(error.details && { details: error.details })
    };
  }
}));
```

### Different Formats for Different Content Types

```typescript
app.use(errorHandler({
  formatError: (error: HttpError, ctx: Context) => {
    const accept = ctx.req.headers.accept || '';

    if (accept.includes('application/xml')) {
      return `<error>
  <status>${error.status}</status>
  <message>${error.message}</message>
</error>`;
    }

    return {
      error: {
        status: error.status,
        message: error.message,
        details: error.details
      }
    };
  }
}));
```

## Async Error Handling

```typescript
app.get('/api/async', async (ctx) => {
  try {
    const data = await riskyAsyncOperation();
    return ctx.json(data);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(500, 'Operation failed');
  }
});
```

## Validation Errors

```typescript
app.post('/api/user', (ctx) => {
  const userData = ctx.getBody();

  const errors = validateUser(userData);
  if (errors.length > 0) {
    throw new HttpError(422, 'Validation failed', {
      errors: errors.map(err => ({
        field: err.field,
        message: err.message
      }))
    });
  }

  const user = createUser(userData);
  return ctx.json(user, 201);
});
```

## Database Errors

```typescript
app.get('/api/users', async (ctx) => {
  try {
    const users = await db.getUsers();
    return ctx.json(users);
  } catch (dbError) {
    console.error('Database error:', dbError);
    throw new HttpError(500, 'Database connection failed');
  }
});
```

## Authentication Errors

```typescript
const requireAuth = (ctx, next) => {
  const token = ctx.getHeader('authorization');

  if (!token) {
    throw new HttpError(401, 'Authentication required');
  }

  try {
    const user = verifyToken(token);
    ctx.req.user = user;
    return next();
  } catch (error) {
    throw new HttpError(401, 'Invalid token');
  }
};

app.get('/api/profile', requireAuth, (ctx) => {
  return ctx.json(ctx.req.user);
});
```

## File Upload Errors

```typescript
app.use(upload());

app.post('/upload', (ctx) => {
  const file = ctx.file;

  if (!file) {
    throw new HttpError(400, 'File is required');
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB
    throw new HttpError(413, 'File too large', {
      maxSize: '10MB',
      actualSize: `${Math.round(file.size / 1024 / 1024)}MB`
    });
  }

  if (!file.mimetype.startsWith('image/')) {
    throw new HttpError(400, 'Only images are allowed', {
      allowedTypes: ['image/*'],
      receivedType: file.mimetype
    });
  }

  return ctx.json({ filename: file.filename });
});
```

## Rate Limiting Errors

```typescript
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: new HttpError(429, 'Too many requests', {
    retryAfter: '15 minutes',
    limit: 100,
    windowMs: 15 * 60 * 1000
  })
}));
```

## Logging Errors

```typescript
app.use(errorHandler({
  onError: (error: HttpError, ctx: Context) => {
    // Log errors
    console.error(`[${new Date().toISOString()}] ${error.status} ${error.message}`, {
      url: ctx.req.url,
      method: ctx.req.method,
      userAgent: ctx.req.headers['user-agent'],
      ip: ctx.req.headers['x-forwarded-for'] || 'unknown',
      details: error.details
    });
  }
}));
```

## Custom Error Types

```typescript
class ValidationError extends HttpError {
  constructor(field: string, reason: string) {
    super(422, 'Validation failed', { field, reason });
  }
}

class NotFoundError extends HttpError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

class ForbiddenError extends HttpError {
  constructor(reason?: string) {
    super(403, reason || 'Access forbidden');
  }
}

// Usage
app.get('/api/user/:id', (ctx) => {
  const user = findUser(ctx.params.id);
  if (!user) {
    throw new NotFoundError('User');
  }

  if (user.isPrivate && !canAccess(ctx.req.user, user)) {
    throw new ForbiddenError('Private profile');
  }

  return ctx.json(user);
});
```

## Error Recovery

```typescript
app.get('/api/fallback', async (ctx) => {
  try {
    const data = await primaryService();
    return ctx.json(data);
  } catch (primaryError) {
    console.warn('Primary service failed, trying fallback');

    try {
      const fallbackData = await fallbackService();
      return ctx.json(fallbackData);
    } catch (fallbackError) {
      throw new HttpError(503, 'Service temporarily unavailable');
    }
  }
});
```

## Testing Error Handling

```typescript
describe('Error Handling', () => {
  it('should return 404 for non-existent user', async () => {
    const app = createApp();
    app.use(errorHandler());

    app.get('/user/:id', (ctx) => {
      throw new HttpError(404, 'User not found');
    });

    const response = await request(app).get('/user/999');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        status: 404,
        message: 'User not found'
      }
    });
  });
});
```

## Configuration Options

```typescript
app.use(errorHandler({
  // Custom error formatter
  formatError: (error: HttpError, ctx?: Context) => {
    // Return custom error format
  },

  // Error logging callback
  onError: (error: HttpError, ctx?: Context) => {
    // Log the error
  },

  // Include stack traces in development
  exposeStack: process.env.NODE_ENV === 'development'
}));
```

## Best Practices

1. **Use Appropriate Status Codes**: Choose the correct HTTP status code for each error type
2. **Provide Clear Messages**: Error messages should be user-friendly but not expose sensitive information
3. **Include Details**: Add relevant details for debugging while avoiding sensitive data
4. **Log Errors**: Always log errors for monitoring and debugging
5. **Handle Async Errors**: Use try-catch in async routes
6. **Validate Input**: Validate input early and throw appropriate errors
7. **Custom Error Types**: Create specific error classes for different error categories

## Examples

See the error handling examples for complete implementations.