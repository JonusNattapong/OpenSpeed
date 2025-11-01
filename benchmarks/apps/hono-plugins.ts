import { Hono } from 'hono';

const app = new Hono();

// Plugin: Request ID generator
const requestIdPlugin = () => {
  return async (c: any, next: any) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    c.set('requestId', requestId);
    c.header('X-Request-ID', requestId);
    await next();
  };
};

// Plugin: Request logger
const loggerPlugin = () => {
  return async (c: any, next: any) => {
    const start = Date.now();
    const requestId = c.get('requestId') || 'unknown';

    console.log(`[${new Date().toISOString()}] [${requestId}] ${c.req.method} ${c.req.path} - Start`);

    await next();

    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${requestId}] ${c.req.method} ${c.req.path} - ${c.res.status} - ${duration}ms`);
  };
};

// Plugin: Response time tracker
const responseTimePlugin = () => {
  return async (c: any, next: any) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    c.header('X-Response-Time', `${duration}ms`);
  };
};

// Plugin: CORS handler
const corsPlugin = (options: { origin?: string; credentials?: boolean } = {}) => {
  const { origin = '*', credentials = false } = options;

  return async (c: any, next: any) => {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');

    if (credentials) {
      c.header('Access-Control-Allow-Credentials', 'true');
    }

    if (c.req.method === 'OPTIONS') {
      return c.text('', 200);
    }

    await next();
  };
};

// Plugin: Rate limiter
const rateLimitPlugin = (options: { windowMs?: number; maxRequests?: number } = {}) => {
  const { windowMs = 60000, maxRequests = 100 } = options;
  const store = new Map<string, { count: number; resetTime: number }>();

  return async (c: any, next: any) => {
    const clientId = c.req.header('X-Client-ID') || c.req.header('X-Forwarded-For') || 'anonymous';
    const now = Date.now();

    const clientData = store.get(clientId) || { count: 0, resetTime: now + windowMs };

    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + windowMs;
    }

    if (clientData.count >= maxRequests) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    clientData.count++;
    store.set(clientId, clientData);

    c.header('X-RateLimit-Remaining', (maxRequests - clientData.count).toString());
    c.header('X-RateLimit-Reset', clientData.resetTime.toString());

    await next();
  };
};

// Plugin: Authentication
const authPlugin = (options: { token?: string } = {}) => {
  const { token = 'benchmark-token' } = options;

  return async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const providedToken = authHeader.substring(7);
    if (providedToken !== token) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    c.set('user', { id: 123, role: 'user', authenticated: true });
    await next();
  };
};

// Plugin: Compression (simplified)
const compressionPlugin = () => {
  return async (c: any, next: any) => {
    await next();

    // In a real implementation, this would compress the response
    c.header('Content-Encoding', 'identity'); // No compression for benchmark
  };
};

// Plugin: Cache
const cachePlugin = (options: { ttl?: number } = {}) => {
  const { ttl = 5000 } = options; // 5 seconds
  const cache = new Map<string, { data: any; timestamp: number; headers: Record<string, string> }>();

  return async (c: any, next: any) => {
    const cacheKey = c.req.method + c.req.path + JSON.stringify(c.req.queries());
    const cached = cache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < ttl) {
      // Return cached response
      Object.entries(cached.headers).forEach(([key, value]) => {
        c.header(key, value);
      });
      c.header('X-Cache', 'HIT');
      return c.json(cached.data);
    }

    await next();

    // Cache the response
    if (c.res.status === 200) {
      const response = c.res.clone();
      const data = await response.json();
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        headers: {
          'X-Cache': 'MISS',
          'X-Cache-TTL': ttl.toString()
        }
      });
    }
  };
};

// Apply plugins globally
app.use('*', requestIdPlugin());
app.use('*', responseTimePlugin());

// Health check (minimal plugins)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    framework: 'hono',
    scenario: 'plugins',
    plugins: ['request-id', 'response-time']
  });
});

// Single plugin endpoint
app.get('/single-plugin', corsPlugin(), (c) => {
  return c.json({
    message: 'Single plugin applied',
    plugins: ['cors'],
    requestId: c.get('requestId'),
    timestamp: new Date().toISOString()
  });
});

// Multiple plugins
app.get('/multiple-plugins',
  corsPlugin(),
  rateLimitPlugin({ maxRequests: 50 }),
  loggerPlugin(),
  (c) => {
    return c.json({
      message: 'Multiple plugins applied',
      plugins: ['cors', 'rate-limit', 'logger'],
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    });
  }
);

// Authenticated endpoint with plugins
app.get('/authenticated',
  authPlugin(),
  corsPlugin(),
  compressionPlugin(),
  (c) => {
    const user = c.get('user');
    return c.json({
      message: 'Authenticated with plugins',
      user,
      plugins: ['auth', 'cors', 'compression'],
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    });
  }
);

// Cached endpoint
app.get('/cached',
  cachePlugin(),
  corsPlugin(),
  (c) => {
    return c.json({
      message: 'Cached response',
      data: Math.random(),
      plugins: ['cache', 'cors'],
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    });
  }
);

// Heavy plugin chain
app.get('/heavy-plugins',
  corsPlugin(),
  rateLimitPlugin(),
  loggerPlugin(),
  authPlugin(),
  compressionPlugin(),
  cachePlugin(),
  (c) => {
    // Simulate processing
    const data = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      value: Math.random(),
      computed: Math.sin(i) * Math.cos(i)
    }));

    return c.json({
      message: 'Heavy plugin chain completed',
      plugins: ['cors', 'rate-limit', 'logger', 'auth', 'compression', 'cache'],
      data: data.slice(0, 5),
      totalItems: data.length,
      user: c.get('user'),
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString()
    });
  }
);

// Plugin performance test
app.get('/plugin-performance', async (c) => {
  const iterations = parseInt(c.req.query('iterations') || '1000');

  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sin(i) * Math.cos(i);
  }

  return c.json({
    message: 'Plugin performance test',
    iterations,
    result,
    plugins: ['request-id', 'response-time'],
    requestId: c.get('requestId'),
    timestamp: new Date().toISOString()
  });
});

// Dynamic plugin loading simulation
app.get('/dynamic-plugins', (c) => {
  const enabledPlugins = c.req.query('plugins')?.split(',') || ['cors'];

  let appliedPlugins: string[] = [];

  // Simulate conditional plugin application
  if (enabledPlugins.includes('cors')) {
    appliedPlugins.push('cors');
  }
  if (enabledPlugins.includes('auth')) {
    appliedPlugins.push('auth');
  }
  if (enabledPlugins.includes('cache')) {
    appliedPlugins.push('cache');
  }

  return c.json({
    message: 'Dynamic plugins applied',
    requested: enabledPlugins,
    applied: appliedPlugins,
    requestId: c.get('requestId'),
    timestamp: new Date().toISOString()
  });
});

const port = process.argv[2] || '3103';
export default {
  port,
  fetch: app.fetch,
};