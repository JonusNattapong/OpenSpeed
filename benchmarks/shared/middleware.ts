// OpenSpeed\benchmarks\shared\middleware.ts

export interface MiddlewareConfig {
  name: string;
  setup: (app: any) => void;
}

export interface MiddlewareChain {
  name: string;
  middlewares: MiddlewareConfig[];
  testRoute: string;
  expectedResponse: {
    type: 'json';
    data: any;
  };
}

export const middlewareChains: MiddlewareChain[] = [
  {
    name: 'health',
    middlewares: [],
    testRoute: '/health',
    expectedResponse: {
      type: 'json',
      data: { status: 'ok', framework: 'openspeed', scenario: 'middleware' }
    }
  },
  {
    name: 'single-middleware',
    middlewares: [
      {
        name: 'cors',
        setup: (app: any) => {
          // CORS middleware setup - framework specific
          if (app.use) {
            app.use((ctx: any, next: any) => {
              ctx.res.headers = {
                ...ctx.res.headers,
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'access-control-allow-headers': 'content-type, authorization',
              };
              return next();
            });
          }
        }
      }
    ],
    testRoute: '/single-middleware',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Single middleware applied',
        middlewares: ['cors'],
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'multiple-middlewares',
    middlewares: [
      {
        name: 'cors',
        setup: (app: any) => {
          if (app.use) {
            app.use((ctx: any, next: any) => {
              ctx.res.headers = {
                ...ctx.res.headers,
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'access-control-allow-headers': 'content-type, authorization',
              };
              return next();
            });
          }
        }
      },
      {
        name: 'logger',
        setup: (app: any) => {
          if (app.use) {
            app.use((ctx: any, next: any) => {
              const start = Date.now();
              return next().then(() => {
                const duration = Date.now() - start;
                console.log(`${ctx.req.method} ${ctx.req.url} - ${duration}ms`);
              });
            });
          }
        }
      },
      {
        name: 'json-parser',
        setup: (app: any) => {
          if (app.use) {
            app.use((ctx: any, next: any) => {
              if (ctx.req.method === 'POST' && ctx.req.headers['content-type']?.includes('application/json')) {
                // Simulate JSON parsing
                ctx.req.body = { test: 'data' };
              }
              return next();
            });
          }
        }
      },
      {
        name: 'rate-limit',
        setup: (app: any) => {
          const requests = new Map();
          if (app.use) {
            app.use((ctx: any, next: any) => {
              const ip = '127.0.0.1';
              const now = Date.now();
              const windowStart = now - 60000;

              if (!requests.has(ip)) {
                requests.set(ip, []);
              }

              const userRequests = requests.get(ip).filter((time: number) => time > windowStart);
              userRequests.push(now);
              requests.set(ip, userRequests);

              ctx.rateLimit = {
                remaining: Math.max(0, 100 - userRequests.length),
                reset: windowStart + 60000,
              };

              return next();
            });
          }
        }
      }
    ],
    testRoute: '/multiple-middlewares',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Multiple middlewares applied',
        middlewares: ['cors', 'logger', 'json-parser', 'rate-limit'],
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'authenticated',
    middlewares: [
      {
        name: 'auth',
        setup: (app: any) => {
          if (app.use) {
            app.use((ctx: any, next: any) => {
              const auth = ctx.req.headers.authorization;
              if (auth === 'Bearer benchmark-token') {
                ctx.user = { id: 1, name: 'Benchmark User' };
              }
              return next();
            });
          }
        }
      }
    ],
    testRoute: '/authenticated',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Authenticated with middlewares',
        user: { id: 1, name: 'Benchmark User' },
        middlewares: ['auth'],
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'cached',
    middlewares: [
      {
        name: 'cache',
        setup: (app: any) => {
          const cache = new Map();
          if (app.use) {
            app.use((ctx: any, next: any) => {
              const key = `${ctx.req.method}:${ctx.req.url}`;
              const cached = cache.get(key);

              if (cached && Date.now() - cached.timestamp < 30000) {
                ctx.cached = true;
                ctx.res = cached.response;
                return;
              }

              return next().then(() => {
                cache.set(key, {
                  response: ctx.res,
                  timestamp: Date.now(),
                });
              });
            });
          }
        }
      }
    ],
    testRoute: '/cached',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Cached response',
        data: '{{randomValue}}',
        middlewares: ['cache'],
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'heavy-middlewares',
    middlewares: [
      {
        name: 'cors',
        setup: (app: any) => {
          if (app.use) {
            app.use((ctx: any, next: any) => {
              ctx.res.headers = {
                ...ctx.res.headers,
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'access-control-allow-headers': 'content-type, authorization',
              };
              return next();
            });
          }
        }
      },
      {
        name: 'logger',
        setup: (app: any) => {
          if (app.use) {
            app.use((ctx: any, next: any) => {
              const start = Date.now();
              return next().then(() => {
                const duration = Date.now() - start;
                console.log(`${ctx.req.method} ${ctx.req.url} - ${duration}ms`);
              });
            });
          }
        }
      },
      {
        name: 'json-parser',
        setup: (app: any) => {
          if (app.use) {
            app.use((ctx: any, next: any) => {
              if (ctx.req.method === 'POST' && ctx.req.headers['content-type']?.includes('application/json')) {
                ctx.req.body = { test: 'data' };
              }
              return next();
            });
          }
        }
      },
      {
        name: 'rate-limit',
        setup: (app: any) => {
          const requests = new Map();
          if (app.use) {
            app.use((ctx: any, next: any) => {
              const ip = '127.0.0.1';
              const now = Date.now();
              const windowStart = now - 60000;

              if (!requests.has(ip)) {
                requests.set(ip, []);
              }

              const userRequests = requests.get(ip).filter((time: number) => time > windowStart);
              userRequests.push(now);
              requests.set(ip, userRequests);

              ctx.rateLimit = {
                remaining: Math.max(0, 100 - userRequests.length),
                reset: windowStart + 60000,
              };

              return next();
            });
          }
        }
      },
      {
        name: 'auth',
        setup: (app: any) => {
          if (app.use) {
            app.use((ctx: any, next: any) => {
              const auth = ctx.req.headers.authorization;
              if (auth === 'Bearer benchmark-token') {
                ctx.user = { id: 1, name: 'Benchmark User' };
              }
              return next();
            });
          }
        }
      },
      {
        name: 'compression',
        setup: (app: any) => {
          if (app.use) {
            app.use((ctx: any, next: any) => {
              return next().then(() => {
                const responseSize = JSON.stringify(ctx.res.body).length;
                if (responseSize > 1024) {
                  ctx.res.headers['content-encoding'] = 'gzip';
                  ctx.compressed = true;
                }
              });
            });
          }
        }
      }
    ],
    testRoute: '/heavy-middlewares',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Heavy middleware chain completed',
        middlewares: ['cors', 'logger', 'json-parser', 'rate-limit', 'auth', 'compression'],
        dataLength: 50,
        sample: '{{sampleData}}',
        totalItems: 50,
        user: { id: 1, name: 'Benchmark User' },
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'conditional-middlewares',
    middlewares: [
      {
        name: 'conditional',
        setup: (app: any) => {
          if (app.use) {
            app.use('/conditional/*', (ctx: any, next: any) => {
              const shouldProcess = Math.random() > 0.5;
              ctx.conditional = shouldProcess;

              if (shouldProcess) {
                ctx.extraData = {
                  processed: true,
                  randomValue: Math.random(),
                  timestamp: Date.now(),
                };
              }

              return next();
            });
          }
        }
      }
    ],
    testRoute: '/conditional/test',
    expectedResponse: {
      type: 'json',
      data: {
        conditional: '{{conditionalFlag}}',
        extraData: '{{extraData}}',
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'async-middlewares',
    middlewares: [
      {
        name: 'async',
        setup: (app: any) => {
          if (app.use) {
            app.use('/async/*', async (ctx: any, next: any) => {
              await new Promise((resolve) => setTimeout(resolve, 1));
              ctx.asyncProcessed = true;
              ctx.asyncTimestamp = Date.now();
              return next();
            });
          }
        }
      }
    ],
    testRoute: '/async/test',
    expectedResponse: {
      type: 'json',
      data: {
        asyncProcessed: true,
        asyncTimestamp: '{{asyncTimestamp}}',
        timestamp: '{{timestamp}}'
      }
    }
  }
];

// Helper functions for dynamic data
export function generateSampleData() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: i,
    value: Math.random(),
    computed: Math.sin(i) * Math.cos(i)
  }));
}

export function getRandomValue() {
  return Math.random();
}

export function getTimestamp() {
  return new Date().toISOString();
}

// Template function for middleware responses
export function templateMiddlewareResponse(data: any, context: any): any {
  if (typeof data === 'string') {
    return data.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      switch (key) {
        case 'timestamp':
          return getTimestamp();
        case 'randomValue':
          return getRandomValue();
        case 'sampleData':
          return JSON.stringify(generateSampleData());
        case 'conditionalFlag':
          return context.conditional || false;
        case 'extraData':
          return context.extraData ? JSON.stringify(context.extraData) : null;
        case 'asyncTimestamp':
          return context.asyncTimestamp || Date.now();
        default:
          return match;
      }
    });
  }
  if (Array.isArray(data)) {
    return data.map(item => templateMiddlewareResponse(item, context));
  }
  if (typeof data === 'object' && data !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = templateMiddlewareResponse(value, context);
    }
    return result;
  }
  return data;
}
