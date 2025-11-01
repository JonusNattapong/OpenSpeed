import { Elysia } from 'elysia';

const app = new Elysia();

// Global middleware - request timing
app.onBeforeHandle(({ request }) => {
  (request as any).startTime = Date.now();
});

app.onAfterHandle(({ request, set }) => {
  const startTime = (request as any).startTime;
  if (startTime) {
    const duration = Date.now() - startTime;
    set.headers['X-Response-Time'] = `${duration}ms`;
  }
});

// Authentication middleware
const authMiddleware = (app: any) =>
  app.derive(({ headers, set }) => {
    const authHeader = headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);
    if (token !== 'benchmark-token') {
      set.status = 401;
      return { error: 'Invalid token' };
    }

    return { user: { id: 123, role: 'user' } };
  });

// CORS middleware
const corsMiddleware = (app: any) =>
  app.derive(({ set }) => {
    set.headers['Access-Control-Allow-Origin'] = '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  });

// Caching middleware
const cacheMiddleware = (app: any) => {
  const cache = new Map();

  return app.derive(({ request, set }) => {
    const cacheKey = request.url + JSON.stringify(Object.fromEntries(request.url.searchParams));
    const cached = cache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < 5000) { // 5 second cache
      set.status = 200;
      return cached.data;
    }

    // Store cache after response
    const originalAfterHandle = set.afterHandle;
    set.afterHandle = (response: any) => {
      if (set.status === 200) {
        cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
      }
      if (originalAfterHandle) originalAfterHandle(response);
    };

    return {};
  });
};

// Rate limiting middleware (simple in-memory)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const rateLimitMiddleware = (app: any) =>
  app.derive(({ headers, set }) => {
    const clientId = headers['x-client-id'] || 'anonymous';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;

    const clientData = rateLimitStore.get(clientId) || { count: 0, resetTime: now + windowMs };

    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + windowMs;
    }

    if (clientData.count >= maxRequests) {
      set.status = 429;
      return { error: 'Rate limit exceeded' };
    }

    clientData.count++;
    rateLimitStore.set(clientId, clientData);

    set.headers['X-RateLimit-Remaining'] = (maxRequests - clientData.count).toString();
    set.headers['X-RateLimit-Reset'] = clientData.resetTime.toString();

    return {};
  });

// Logging middleware
const loggingMiddleware = (app: any) =>
  app.derive(({ request }) => {
    const start = (request as any).startTime || Date.now();
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);

    // Log after response
    const originalAfterHandle = (app as any).afterHandle;
    (app as any).afterHandle = (response: any) => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${request.method} ${request.url} - 200 - ${duration}ms`);
      if (originalAfterHandle) originalAfterHandle(response);
    };

    return {};
  });

// Health check (no middleware)
app.get('/health', () => {
  return {
    status: 'ok',
    framework: 'elysia',
    scenario: 'middleware',
    middleware: []
  };
});

// Single middleware endpoint
app.use(corsMiddleware)
  .get('/single-middleware', () => {
    return {
      message: 'Single middleware applied',
      cors: true,
      timestamp: new Date().toISOString()
    };
  });

// Multiple middleware chain
app.use(corsMiddleware)
  .use(rateLimitMiddleware)
  .use(loggingMiddleware)
  .get('/middleware-chain', () => {
    return {
      message: 'Multiple middleware chain applied',
      middleware: ['cors', 'rate-limit', 'logging'],
      timestamp: new Date().toISOString()
    };
  });

// Authenticated endpoint
app.use(authMiddleware)
  .use(corsMiddleware)
  .get('/authenticated', ({ user }) => {
    return {
      message: 'Authenticated endpoint',
      user,
      timestamp: new Date().toISOString()
    };
  });

// Cached endpoint
app.use(cacheMiddleware)
  .use(corsMiddleware)
  .get('/cached', () => {
    return {
      message: 'Cached response',
      data: Math.random(),
      timestamp: new Date().toISOString(),
      cached: false // Would be true if served from cache
    };
  });

// Heavy middleware chain
app.use(corsMiddleware)
  .use(rateLimitMiddleware)
  .use(loggingMiddleware)
  .use(authMiddleware)
  .use(cacheMiddleware)
  .get('/heavy-chain', () => {
    // Simulate some processing
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      value: Math.random(),
      computed: Math.sin(i) * Math.cos(i)
    }));

    return {
      message: 'Heavy middleware chain completed',
      middleware: ['cors', 'rate-limit', 'logging', 'auth', 'cache'],
      data: data.slice(0, 10), // Return first 10 items
      totalItems: data.length,
      timestamp: new Date().toISOString()
    };
  });

// Middleware performance test
app.get('/performance-test', ({ query }) => {
  const iterations = parseInt(query.iterations || '1000');

  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sin(i) * Math.cos(i);
  }

  return {
    message: 'Performance test completed',
    iterations,
    result,
    timestamp: new Date().toISOString()
  };
});

// Middleware with async operations
app.use(corsMiddleware)
  .get('/async-middleware', async () => {
    // Simulate async database call
    await new Promise(resolve => setTimeout(resolve, 10));

    return {
      message: 'Async middleware completed',
      asyncOperation: true,
      delay: 10,
      timestamp: new Date().toISOString()
    };
  });

const port = process.argv[2] || '3202';
export default {
  port,
  fetch: app.fetch,
};