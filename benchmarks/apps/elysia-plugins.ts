import { Elysia } from 'elysia';
import { pluginChains, templatePluginResponse } from '../shared/plugins.js';

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
  enabledPlugins?: string[];
  processedData?: any[];
}

const app = new Elysia();

// Define Elysia-specific plugin implementations
const pluginMap: Record<string, (app: Elysia) => Elysia> = {
  cors: (app) =>
    app.onBeforeHandle(({ set }) => {
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
  json: (app) =>
    app.onBeforeHandle(({ request, set }) => {
      if (
        request.method === 'POST' &&
        request.headers.get('content-type')?.includes('application/json')
      ) {
        (set as any).body = { test: 'data' };
      }
    }),
  rateLimit: (() => {
    const requests = new Map();
    return (app: Elysia) =>
      app.onBeforeHandle(({ set }) => {
        const ip = '127.0.0.1';
        const now = Date.now();
        const windowStart = now - 60000;

        if (!requests.has(ip)) {
          requests.set(ip, []);
        }

        const userRequests = requests.get(ip).filter((time: number) => time > windowStart);
        userRequests.push(now);
        requests.set(ip, userRequests);

        (set as any).rateLimit = {
          remaining: Math.max(0, 100 - userRequests.length),
          reset: windowStart + 60000,
        };
      });
  })(),
  auth: (app) =>
    app.onBeforeHandle(({ headers, set }) => {
      const auth = headers.authorization;
      if (auth === 'Bearer benchmark-token') {
        (set as any).user = { id: 1, name: 'Benchmark User' };
      }
    }),
  cache: (() => {
    const cache = new Map();
    return (app: Elysia) =>
      app
        .onBeforeHandle(({ request, set }) => {
          const key = `${request.method}:${request.url}`;
          const cached = cache.get(key);

          if (cached && Date.now() - cached.timestamp < 30000) {
            (set as any).cached = true;
            return cached.data;
          }
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
        (set as any).compressed = true;
      }
    }),
  dynamic: (app) =>
    app.onBeforeHandle(({ request, set }) => {
      const enabledPlugins = new URL(request.url).searchParams.get('plugins')?.split(',') || [
        'cors',
      ];
      (set as any).enabledPlugins = enabledPlugins;
    }),
};

// Apply plugin chains from shared config
for (const chain of pluginChains) {
  let chainedApp = app;
  for (const plugin of chain.plugins) {
    const pluginFn = pluginMap[plugin.name];
    if (pluginFn) {
      chainedApp = pluginFn(chainedApp);
    }
  }

  // Add the test route
  chainedApp.get(chain.testRoute, ({ set }) => {
    const context = {
      enabledPlugins: (set as any).enabledPlugins,
    };
    const data = templatePluginResponse(chain.expectedResponse.data, context);
    return data;
  });
}

const port = process.argv[2] || '3203';
export default {
  port,
  fetch: app.fetch,
};
