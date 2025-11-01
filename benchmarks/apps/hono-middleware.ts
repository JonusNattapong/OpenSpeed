import { Hono } from 'hono';

const app = new Hono();

// Global middleware - request timing
app.use('*', async (c, next) => {
  const start = Date.now();
  c.set('startTime', start);
  await next();
  const duration = Date.now() - start;
  c.header('X-Response-Time', `${duration}ms`);
});

// Authentication middleware
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  if (token !== 'benchmark-token') {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('user', { id: 123, role: 'user' });
  await next();
};

// CORS middleware
const corsMiddleware = async (c: any, next: any) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }

  await next();
};

// Caching middleware
const cacheMiddleware = async (c: any, next: any) => {
  const cacheKey = c.req.path + JSON.stringify(c.req.queries());
  const cached = c.get(`cache_${cacheKey}`);

  if (cached && (Date.now() - cached.timestamp) < 5000) { // 5 second cache
    return c.json(cached.data);
  }

  await next();

  // Cache the response
  const response = c.res.clone();
  if (response.ok) {
    const data = await response.json();
    c.set(`cache_${cacheKey}`, {
      data,
      timestamp: Date.now()
    });
  }
};

// Rate limiting middleware (simple in-memory)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const rateLimitMiddleware = async (c: any, next: any) => {
  const clientId = c.req.header('X-Client-ID') || 'anonymous';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;

  const clientData = rateLimitStore.get(clientId) || { count: 0, resetTime: now + windowMs };

  if (now > clientData.resetTime) {
    clientData.count = 0;
    clientData.resetTime = now + windowMs;
  }

  if (clientData.count >= maxRequests) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  clientData.count++;
  rateLimitStore.set(clientId, clientData);

  c.header('X-RateLimit-Remaining', (maxRequests - clientData.count).toString());
  c.header('X-RateLimit-Reset', clientData.resetTime.toString());

  await next();
};

// Logging middleware
const loggingMiddleware = async (c: any, next: any) => {
  const start = c.get('startTime') || Date.now();
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);

  await next();

  const duration = Date.now() - start;
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path} - ${c.res.status} - ${duration}ms`);
};

// Health check (no middleware)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    framework: 'hono',
    scenario: 'middleware',
    middleware: []
  });
});

// Single middleware endpoint
app.get('/single-middleware', corsMiddleware, (c) => {
  return c.json({
    message: 'Single middleware applied',
    cors: true,
    timestamp: new Date().toISOString()
  });
});

// Multiple middleware chain
app.get('/middleware-chain',
  corsMiddleware,
  rateLimitMiddleware,
  loggingMiddleware,
  (c) => {
    return c.json({
      message: 'Multiple middleware chain applied',
      middleware: ['cors', 'rate-limit', 'logging'],
      timestamp: new Date().toISOString(),
      user: c.get('user')
    });
  }
);

// Authenticated endpoint
app.get('/authenticated',
  authMiddleware,
  corsMiddleware,
  (c) => {
    const user = c.get('user');
    return c.json({
      message: 'Authenticated endpoint',
      user,
      timestamp: new Date().toISOString()
    });
  }
);

// Cached endpoint
app.get('/cached',
  cacheMiddleware,
  corsMiddleware,
  (c) => {
    return c.json({
      message: 'Cached response',
      data: Math.random(),
      timestamp: new Date().toISOString(),
      cached: false // Would be true if served from cache
    });
  }
);

// Heavy middleware chain
app.get('/heavy-chain',
  corsMiddleware,
  rateLimitMiddleware,
  loggingMiddleware,
  authMiddleware,
  cacheMiddleware,
  (c) => {
    // Simulate some processing
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      value: Math.random(),
      computed: Math.sin(i) * Math.cos(i)
    }));

    return c.json({
      message: 'Heavy middleware chain completed',
      middleware: ['cors', 'rate-limit', 'logging', 'auth', 'cache'],
      data: data.slice(0, 10), // Return first 10 items
      totalItems: data.length,
      timestamp: new Date().toISOString(),
      user: c.get('user')
    });
  }
);

// Middleware performance test
app.get('/performance-test', async (c) => {
  const iterations = parseInt(c.req.query('iterations') || '1000');

  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sin(i) * Math.cos(i);
  }

  return c.json({
    message: 'Performance test completed',
    iterations,
    result,
    timestamp: new Date().toISOString()
  });
});

// Middleware with async operations
app.get('/async-middleware',
  corsMiddleware,
  async (c) => {
    // Simulate async database call
    await new Promise(resolve => setTimeout(resolve, 10));

    return c.json({
      message: 'Async middleware completed',
      asyncOperation: true,
      delay: 10,
      timestamp: new Date().toISOString()
    });
  }
);

const port = process.argv[2] || '3102';
export default {
  port,
  fetch: app.fetch,
};