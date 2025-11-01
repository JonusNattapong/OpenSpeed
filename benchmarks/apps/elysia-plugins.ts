import { Elysia } from 'elysia';

// Plugin: Request ID generator
const requestIdPlugin = () => (app: any) =>
  app.derive(({ set }) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    set.headers['X-Request-ID'] = requestId;
    return { requestId };
  });

// Plugin: Request logger
const loggerPlugin = () => (app: any) =>
  app.onBeforeHandle(({ request, store }) => {
    const requestId = (store as any).requestId || 'unknown';
    (store as any).startTime = Date.now();
    console.log(`[${new Date().toISOString()}] [${requestId}] ${request.method} ${request.url} - Start`);
  })
  .onAfterHandle(({ request, store, set }) => {
    const requestId = (store as any).requestId || 'unknown';
    const startTime = (store as any).startTime || Date.now();
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [${requestId}] ${request.method} ${request.url} - ${set.status} - ${duration}ms`);
  });

// Plugin: Response time tracker
const responseTimePlugin = () => (app: any) =>
  app.onBeforeHandle(({ store }) => {
    (store as any).startTime = Date.now();
  })
  .onAfterHandle(({ store, set }) => {
    const startTime = (store as any).startTime;
    if (startTime) {
      const duration = Date.now() - startTime;
      set.headers['X-Response-Time'] = `${duration}ms`;
    }
  });

// Plugin: CORS handler
const corsPlugin = (options: { origin?: string; credentials?: boolean } = {}) => {
  const { origin = '*', credentials = false } = (app: any) =>
    app.onBeforeHandle(({ set }) => {
      set.headers['Access-Control-Allow-Origin'] = origin;
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Request-ID';

      if (credentials) {
        set.headers['Access-Control-Allow-Credentials'] = 'true';
      }
    })
    .onRequest(({ request, set }) => {
      if (request.method === 'OPTIONS') {
        set.status = 200;
        return '';
      }
    });
};

// Plugin: Rate limiter
const rateLimitPlugin = (options: { windowMs?: number; maxRequests?: number } = {}) => {
  const { windowMs = 60000, maxRequests = 100 } = options;
  const store = new Map<string, { count: number; resetTime: number }>();

  return (app: any) =>
    app.onBeforeHandle(({ headers, set }) => {
      const clientId = headers['x-client-id'] || headers['x-forwarded-for'] || 'anonymous';
      const now = Date.now();

      const clientData = store.get(clientId) || { count: 0, resetTime: now + windowMs };

      if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + windowMs;
      }

      if (clientData.count >= maxRequests) {
        set.status = 429;
        return { error: 'Rate limit exceeded' };
      }

      clientData.count++;
      store.set(clientId, clientData);

      set.headers['X-RateLimit-Remaining'] = (maxRequests - clientData.count).toString();
      set.headers['X-RateLimit-Reset'] = clientData.resetTime.toString();
    });
};

// Plugin: Authentication
const authPlugin = (options: { token?: string } = {}) => {
  const { token = 'benchmark-token' } = options;

  return (app: any) =>
    app.derive(({ headers, set }) => {
      const authHeader = headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const providedToken = authHeader.substring(7);
      if (providedToken !== token) {
        set.status = 401;
        return { error: 'Invalid token' };
      }

      return { user: { id: 123, role: 'user', authenticated: true } };
    });
};

// Plugin: Compression (simplified)
const compressionPlugin = () => (app: any) =>
  app.onAfterHandle(({ set }) => {
    // In a real implementation, this would compress the response
    set.headers['Content-Encoding'] = 'identity'; // No compression for benchmark
  });

// Plugin: Cache
const cachePlugin = (options: { ttl?: number } = {}) => {
  const { ttl = 5000 } = options; // 5 seconds
  const cache = new Map<string, { data: any; timestamp: number; headers: Record<string, string> }>();

  return (app: any) =>
    app.derive(({ request, set }) => {
      const cacheKey = request.method + request.url + JSON.stringify(Object.fromEntries(request.url.searchParams));
      const cached = cache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < ttl) {
        // Return cached response
        Object.entries(cached.headers).forEach(([key, value]) => {
          set.headers[key] = value;
        });
        set.headers['X-Cache'] = 'HIT';
        return cached.data;
      }

      return {};
    })
    .onAfterHandle(({ request, set }) => {
      if (set.status === 200) {
        const cacheKey = request.method + request.url + JSON.stringify(Object.fromEntries(request.url.searchParams));
        // Note: In a real implementation, we'd capture the response data here
        cache.set(cacheKey, {
          data: {}, // Would be the actual response data
          timestamp: Date.now(),
          headers: {
            'X-Cache': 'MISS',
            'X-Cache-TTL': ttl.toString()
          }
        });
      }
    });
};

const app = new Elysia();

// Apply plugins globally
app.use(requestIdPlugin());
app.use(responseTimePlugin());

// Health check (minimal plugins)
app.get('/health', () => {
  return {
    status: 'ok',
    framework: 'elysia',
    scenario: 'plugins',
    plugins: ['request-id', 'response-time']
  };
});

// Single plugin endpoint
app.use(corsPlugin())
  .get('/single-plugin', ({ requestId }) => {
    return {
      message: 'Single plugin applied',
      plugins: ['cors'],
      requestId,
      timestamp: new Date().toISOString()
    };
  });

// Multiple plugins
app.use(corsPlugin())
  .use(rateLimitPlugin({ maxRequests: 50 }))
  .use(loggerPlugin())
  .get('/multiple-plugins', ({ requestId }) => {
    return {
      message: 'Multiple plugins applied',
      plugins: ['cors', 'rate-limit', 'logger'],
      requestId,
      timestamp: new Date().toISOString()
    };
  });

// Authenticated endpoint with plugins
app.use(authPlugin())
  .use(corsPlugin())
  .use(compressionPlugin())
  .get('/authenticated', ({ user, requestId }) => {
    return {
      message: 'Authenticated with plugins',
      user,
      plugins: ['auth', 'cors', 'compression'],
      requestId,
      timestamp: new Date().toISOString()
    };
  });

// Cached endpoint
app.use(cachePlugin())
  .use(corsPlugin())
  .get('/cached', ({ requestId }) => {
    return {
      message: 'Cached response',
      data: Math.random(),
      plugins: ['cache', 'cors'],
      requestId,
      timestamp: new Date().toISOString()
    };
  });

// Heavy plugin chain
app.use(corsPlugin())
  .use(rateLimitPlugin())
  .use(loggerPlugin())
  .use(authPlugin())
  .use(compressionPlugin())
  .use(cachePlugin())
  .get('/heavy-plugins', ({ user, requestId }) => {
    // Simulate processing
    const data = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      value: Math.random(),
      computed: Math.sin(i) * Math.cos(i)
    }));

    return {
      message: 'Heavy plugin chain completed',
      plugins: ['cors', 'rate-limit', 'logger', 'auth', 'compression', 'cache'],
      data: data.slice(0, 5),
      totalItems: data.length,
      user,
      requestId,
      timestamp: new Date().toISOString()
    };
  });

// Plugin performance test
app.get('/plugin-performance', ({ query, requestId }) => {
  const iterations = parseInt(query.iterations || '1000');

  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sin(i) * Math.cos(i);
  }

  return {
    message: 'Plugin performance test',
    iterations,
    result,
    plugins: ['request-id', 'response-time'],
    requestId,
    timestamp: new Date().toISOString()
  };
});

// Dynamic plugin loading simulation
app.get('/dynamic-plugins', ({ query, requestId }) => {
  const enabledPlugins = query.plugins?.split(',') || ['cors'];

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

  return {
    message: 'Dynamic plugins applied',
    requested: enabledPlugins,
    applied: appliedPlugins,
    requestId,
    timestamp: new Date().toISOString()
  };
});

const port = process.argv[2] || '3203';
export default {
  port,
  fetch: app.fetch,
};