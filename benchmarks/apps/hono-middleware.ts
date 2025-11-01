import { Hono } from 'hono';
import { middlewareChains, templateMiddlewareResponse } from '../shared/middleware.js';

// Extend Hono context for benchmark properties
interface BenchmarkContext {
  startTime?: number;
  user?: any;
  requestId?: string;
  responseTime?: number;
  rateLimit?: any;
  compressed?: boolean;
  cached?: boolean;
  error?: any;
  conditional?: boolean;
  extraData?: any;
  asyncProcessed?: boolean;
  asyncTimestamp?: number;
  processedData?: any[];
}

const app = new Hono<{ Variables: BenchmarkContext }>();

// Define Hono-specific middleware implementations
const middlewareMap: Record<string, any> = {
  cors: async (c: any, next: any) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (c.req.method === 'OPTIONS') {
      return c.text('', 200);
    }
    await next();
  },
  logger: async (c: any, next: any) => {
    const start = Date.now();
    console.log(`${c.req.method} ${c.req.path}`);
    await next();
    const duration = Date.now() - start;
    console.log(`${c.req.method} ${c.req.path} - ${duration}ms`);
  },
  'json-parser': async (c: any, next: any) => {
    if (c.req.method === 'POST' && c.req.header('content-type')?.includes('application/json')) {
      // Simulate JSON parsing
      c.set('body', { test: 'data' });
    }
    await next();
  },
  'rate-limit': (() => {
    const requests = new Map();
    return async (c: any, next: any) => {
      const ip = '127.0.0.1';
      const now = Date.now();
      const windowStart = now - 60000;

      if (!requests.has(ip)) {
        requests.set(ip, []);
      }

      const userRequests = requests.get(ip).filter((time: number) => time > windowStart);
      userRequests.push(now);
      requests.set(ip, userRequests);

      c.set('rateLimit', {
        remaining: Math.max(0, 100 - userRequests.length),
        reset: windowStart + 60000,
      });

      await next();
    };
  })(),
  auth: async (c: any, next: any) => {
    const auth = c.req.header('Authorization');
    if (auth === 'Bearer benchmark-token') {
      c.set('user', { id: 1, name: 'Benchmark User' });
    }
    await next();
  },
  cache: (() => {
    const cache = new Map();
    return async (c: any, next: any) => {
      const key = `${c.req.method}:${c.req.path}`;
      const cached = cache.get(key);

      if (cached && Date.now() - cached.timestamp < 30000) {
        c.set('cached', true);
        return c.json(cached.data);
      }

      await next();

      const response = c.res.clone();
      if (response.ok) {
        const data = await response.json();
        cache.set(key, {
          data,
          timestamp: Date.now(),
        });
      }
    };
  })(),
  compression: async (c: any, next: any) => {
    await next();
    const responseSize = JSON.stringify(c.res.body).length;
    if (responseSize > 1024) {
      c.header('Content-Encoding', 'gzip');
      c.set('compressed', true);
    }
  },
  conditional: async (c: any, next: any) => {
    const shouldProcess = Math.random() > 0.5;
    c.set('conditional', shouldProcess);

    if (shouldProcess) {
      c.set('extraData', {
        processed: true,
        randomValue: Math.random(),
        timestamp: Date.now(),
      });
    }

    await next();
  },
  async: async (c: any, next: any) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    c.set('asyncProcessed', true);
    c.set('asyncTimestamp', Date.now());
    await next();
  },
};

// Apply middleware chains from shared config
for (const chain of middlewareChains) {
  const middlewares = chain.middlewares.map((m) => middlewareMap[m.name]).filter(Boolean);

  // Add the test route with middlewares applied
  app.get(chain.testRoute, ...middlewares, (c) => {
    const context = {
      conditional: c.get('conditional'),
      extraData: c.get('extraData'),
      asyncTimestamp: c.get('asyncTimestamp'),
    };
    const data = templateMiddlewareResponse(chain.expectedResponse.data, context);
    return c.json(data);
  });
}

const port = process.argv[2] || '3102';
export default {
  port,
  fetch: app.fetch,
};
