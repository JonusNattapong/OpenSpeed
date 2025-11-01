OpenSpeed\benchmarks\shared\plugins.ts

export interface PluginConfig {
  name: string;
  setup: (app: any) => void;
}

export interface PluginChain {
  name: string;
  plugins: PluginConfig[];
  testRoute: string;
  expectedResponse: {
    type: 'json';
    data: any;
  };
}

export const pluginChains: PluginChain[] = [
  {
    name: 'health',
    plugins: [],
    testRoute: '/health',
    expectedResponse: {
      type: 'json',
      data: { status: 'ok', framework: 'openspeed', scenario: 'plugins' }
    }
  },
  {
    name: 'single-plugin',
    plugins: [
      {
        name: 'cors',
        setup: (app: any) => {
          // CORS plugin setup
          if (app.plugin) {
            app.plugin('cors', (app: any) => {
              app.use((ctx: any, next: any) => {
                ctx.res.headers = {
                  ...ctx.res.headers,
                  'access-control-allow-origin': '*',
                  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
                  'access-control-allow-headers': 'content-type, authorization',
                };
                return next();
              });
            });
          }
        }
      }
    ],
    testRoute: '/single-plugin',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Single plugin applied',
        plugins: ['cors'],
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'multiple-plugins',
    plugins: [
      {
        name: 'cors',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('cors', (app: any) => {
              app.use((ctx: any, next: any) => {
                ctx.res.headers = {
                  ...ctx.res.headers,
                  'access-control-allow-origin': '*',
                  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
                  'access-control-allow-headers': 'content-type, authorization',
                };
                return next();
              });
            });
          }
        }
      },
      {
        name: 'logger',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('logger', (app: any) => {
              app.use((ctx: any, next: any) => {
                const start = Date.now();
                return next().then(() => {
                  const duration = Date.now() - start;
                  console.log(`${ctx.req.method} ${ctx.req.url} - ${duration}ms`);
                });
              });
            });
          }
        }
      },
      {
        name: 'json',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('json', (app: any) => {
              app.use((ctx: any, next: any) => {
                if (ctx.req.method === 'POST' && ctx.req.headers['content-type']?.includes('application/json')) {
                  ctx.req.body = { test: 'data' };
                }
                return next();
              });
            });
          }
        }
      },
      {
        name: 'rateLimit',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('rateLimit', (app: any) => {
              const requests = new Map();
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
            });
          }
        }
      }
    ],
    testRoute: '/multiple-plugins',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Multiple plugins applied',
        plugins: ['cors', 'logger', 'json', 'rateLimit'],
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'authenticated',
    plugins: [
      {
        name: 'auth',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('auth', (app: any) => {
              app.use((ctx: any, next: any) => {
                const auth = ctx.req.headers.authorization;
                if (auth === 'Bearer benchmark-token') {
                  ctx.user = { id: 1, name: 'Benchmark User' };
                }
                return next();
              });
            });
          }
        }
      }
    ],
    testRoute: '/authenticated',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Authenticated with plugins',
        user: { id: 1, name: 'Benchmark User' },
        plugins: ['auth'],
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'cached',
    plugins: [
      {
        name: 'cache',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('cache', (app: any) => {
              const cache = new Map();
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
        plugins: ['cache'],
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'heavy-plugins',
    plugins: [
      {
        name: 'cors',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('cors', (app: any) => {
              app.use((ctx: any, next: any) => {
                ctx.res.headers = {
                  ...ctx.res.headers,
                  'access-control-allow-origin': '*',
                  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
                  'access-control-allow-headers': 'content-type, authorization',
                };
                return next();
              });
            });
          }
        }
      },
      {
        name: 'logger',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('logger', (app: any) => {
              app.use((ctx: any, next: any) => {
                const start = Date.now();
                return next().then(() => {
                  const duration = Date.now() - start;
                  console.log(`${ctx.req.method} ${ctx.req.url} - ${duration}ms`);
                });
              });
            });
          }
        }
      },
      {
        name: 'json',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('json', (app: any) => {
              app.use((ctx: any, next: any) => {
                if (ctx.req.method === 'POST' && ctx.req.headers['content-type']?.includes('application/json')) {
                  ctx.req.body = { test: 'data' };
                }
                return next();
              });
            });
          }
        }
      },
      {
        name: 'rateLimit',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('rateLimit', (app: any) => {
              const requests = new Map();
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
            });
          }
        }
      },
      {
        name: 'auth',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('auth', (app: any) => {
              app.use((ctx: any, next: any) => {
                const auth = ctx.req.headers.authorization;
                if (auth === 'Bearer benchmark-token') {
                  ctx.user = { id: 1, name: 'Benchmark User' };
                }
                return next();
              });
            });
          }
        }
      },
      {
        name: 'compression',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('compression', (app: any) => {
              app.use((ctx: any, next: any) => {
                return next().then(() => {
                  const responseSize = JSON.stringify(ctx.res.body).length;
                  if (responseSize > 1024) {
                    ctx.res.headers['content-encoding'] = 'gzip';
                    ctx.compressed = true;
                  }
                });
              });
            });
          }
        }
      }
    ],
    testRoute: '/heavy-plugins',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Heavy plugin chain completed',
        plugins: ['cors', 'logger', 'json', 'rateLimit', 'auth', 'compression'],
        dataLength: 50,
        sample: '{{sampleData}}',
        totalItems: 50,
        user: { id: 1, name: 'Benchmark User' },
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'plugin-performance',
    plugins: [
      {
        name: 'cors',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('cors', (app: any) => {
              app.use((ctx: any, next: any) => {
                ctx.res.headers = {
                  ...ctx.res.headers,
                  'access-control-allow-origin': '*',
                  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
                  'access-control-allow-headers': 'content-type, authorization',
                };
                return next();
              });
            });
          }
        }
      },
      {
        name: 'logger',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('logger', (app: any) => {
              app.use((ctx: any, next: any) => {
                const start = Date.now();
                return next().then(() => {
                  const duration = Date.now() - start;
                  console.log(`${ctx.req.method} ${ctx.req.url} - ${duration}ms`);
                });
              });
            });
          }
        }
      }
    ],
    testRoute: '/plugin-performance',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Plugin performance test',
        iterations: 1000,
        result: '{{computedResult}}',
        plugins: ['cors', 'logger'],
        timestamp: '{{timestamp}}'
      }
    }
  },
  {
    name: 'dynamic-plugins',
    plugins: [
      {
        name: 'dynamic',
        setup: (app: any) => {
          if (app.plugin) {
            app.plugin('dynamic', (app: any) => {
              app.use((ctx: any, next: any) => {
                const enabledPlugins = ctx.req.query?.plugins?.split(',') || ['cors'];
                ctx.enabledPlugins = enabledPlugins;
                return next();
              });
            });
          }
        }
      }
    ],
    testRoute: '/dynamic-plugins',
    expectedResponse: {
      type: 'json',
      data: {
        message: 'Dynamic plugins applied',
        requested: '{{enabledPlugins}}',
        applied: '{{enabledPlugins}}',
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

export function computePerformanceResult(iterations: number) {
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sin(i) * Math.cos(i);
  }
  return result;
}

// Template function for plugin responses
export function templatePluginResponse(data: any, context: any): any {
  if (typeof data === 'string') {
    return data.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      switch (key) {
        case 'timestamp':
          return getTimestamp();
        case 'randomValue':
          return getRandomValue();
        case 'sampleData':
          return JSON.stringify(generateSampleData());
        case 'computedResult':
          return computePerformanceResult(1000);
        case 'enabledPlugins':
          return JSON.stringify(context.enabledPlugins || ['cors']);
        default:
          return match;
      }
    });
  }
  if (Array.isArray(data)) {
    return data.map(item => templatePluginResponse(item, context));
  }
  if (typeof data === 'object' && data !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = templatePluginResponse(value, context);
    }
    return result;
  }
  return data;
}
