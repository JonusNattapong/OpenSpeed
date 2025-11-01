import { Elysia } from 'elysia';
import { middlewareChains, templateMiddlewareResponse } from '../shared/middleware.js';

// Extend Elysia context for benchmark properties
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

const app = new Elysia();

// Define Elysia-specific middleware implementations
const middlewareMap: Record<string, (app: Elysia) => Elysia> = {
  cors: (app) =>
    app.derive(({ set }) => {
      set.headers['Access-Control-Allow-Origin'] = '*';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }),
  logger: (app) =>
    app
      .onBeforeHandle(({ request }) => {
        console.log(`${request.method} ${request.url}`);
      })
      .onAfterHandle(({ request }) => {
        console.log(`${request.method} ${request.url} - completed`);
      }),
  'json-parser': (app) =>
    app.derive(({ request, set }) => {
      if (
        request.method === 'POST' &&
        request.headers.get('content-type')?.includes('application/json')
      ) {
        // Simulate JSON parsing
        set.body = { test: 'data' };
      }
    }),
  'rate-limit': (() => {
    const requests = new Map();
    return (app: Elysia) =>
      app.derive(({ set }) => {
        const ip = '127.0.0.1';
        const now = Date.now();
        const windowStart = now - 60000;

        if (!requests.has(ip)) {
          requests.set(ip, []);
        }

        const userRequests = requests.get(ip).filter((time: number) => time > windowStart);
        userRequests.push(now);
        requests.set(ip, userRequests);

        set.rateLimit = {
          remaining: Math.max(0, 100 - userRequests.length),
          reset: windowStart + 60000,
        };
      });
  })(),
  auth: (app) =>
    app.derive(({ headers, set }) => {
      const auth = headers.authorization;
      if (auth === 'Bearer benchmark-token') {
        set.user = { id: 1, name: 'Benchmark User' };
      }
    }),
  cache: (() => {
    const cache = new Map();
    return (app: Elysia) =>
      app
        .derive(({ request, set }) => {
          const key = `${request.method}:${request.url}`;
          const cached = cache.get(key);

          if (cached && Date.now() - cached.timestamp < 30000) {
            set.cached = true;
            return cached.data;
          }

          // Note: Elysia handles response caching differently, this is simplified
        })
        .onAfterHandle(({ request, response, set }) => {
          const key = `${request.method}:${request.url}`;
          if (set.status === 200) {
            cache.set(key, {
              data: response,
              timestamp: Date.now(),
            });
          }
        });
  })(),
  compression: (app) =>
    app.onAfterHandle(({ response, set }) => {
      const responseSize = JSON.stringify(response).length;
      if (responseSize > 1024) {
        set.headers['Content-Encoding'] = 'gzip';
        set.compressed = true;
      }
    }),
  conditional: (app) =>
    app.derive(({ set }) => {
      const shouldProcess = Math.random() > 0.5;
      set.conditional = shouldProcess;

      if (shouldProcess) {
        set.extraData = {
          processed: true,
          randomValue: Math.random(),
          timestamp: Date.now(),
        };
      }
    }),
  async: (app) =>
    app.derive(async ({ set }) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      set.asyncProcessed = true;
      set.asyncTimestamp = Date.now();
    }),
};

// Apply middleware chains from shared config
for (const chain of middlewareChains) {
  let chainedApp = app;
  for (const middleware of chain.middlewares) {
    const middlewareFn = middlewareMap[middleware.name];
    if (middlewareFn) {
      chainedApp = middlewareFn(chainedApp);
    }
  }

  // Add the test route
  chainedApp.get(chain.testRoute, ({ set }) => {
    const context = {
      conditional: set.conditional,
      extraData: set.extraData,
      asyncTimestamp: set.asyncTimestamp,
    };
    const data = templateMiddlewareResponse(chain.expectedResponse.data, context);
    return data;
  });
}

const port = process.argv[2] || '3202';
export default {
  port,
  fetch: app.fetch,
};
