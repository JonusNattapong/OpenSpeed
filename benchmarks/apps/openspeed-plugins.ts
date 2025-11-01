OpenSpeed\benchmarks\apps\openspeed-plugins.ts
import { Openspeed, cors, logger, json, errorHandler, auth, rateLimit } from '../../src/openspeed/index.js';
import type { Context } from '../../src/openspeed/context.js';

// Extend Context for benchmark properties
interface BenchmarkContext extends Context {
  startTime?: number;
  user?: any;
  requestId?: string;
}

const app = Openspeed();

// Apply plugins globally
app.use(cors());
app.use(logger());
app.use(json());
app.use(errorHandler());
app.use(rateLimit({ windowMs: 60000, max: 100 }));
app.use(auth({ secret: 'benchmark-secret' }));

// Health check
app.get('/health', (ctx: BenchmarkContext) => {
  return ctx.json({
    status: 'ok',
    framework: 'openspeed',
    scenario: 'plugins',
    plugins: ['cors', 'logger', 'json', 'errorHandler', 'rateLimit', 'auth']
  });
});

// Single plugin endpoint
app.get('/single-plugin', (ctx: BenchmarkContext) => {
  return ctx.json({
    message: 'Single plugin applied',
    plugins: ['cors'],
    timestamp: new Date().toISOString()
  });
});

// Multiple plugins
app.get('/multiple-plugins', (ctx: BenchmarkContext) => {
  return ctx.json({
    message: 'Multiple plugins applied',
    plugins: ['cors', 'logger', 'json', 'rateLimit'],
    timestamp: new Date().toISOString()
  });
});

// Authenticated endpoint
app.get('/authenticated', (ctx: BenchmarkContext) => {
  // Auth plugin sets ctx.user
  return ctx.json({
    message: 'Authenticated with plugins',
    user: ctx.user,
    plugins: ['auth', 'cors'],
    timestamp: new Date().toISOString()
  });
});

// Cached endpoint (simulate with rateLimit)
app.get('/cached', (ctx: BenchmarkContext) => {
  return ctx.json({
    message: 'Cached response',
    data: Math.random(),
    plugins: ['cors', 'rateLimit'],
    timestamp: new Date().toISOString()
  });
});

// Heavy plugin chain
app.get('/heavy-plugins', (ctx: BenchmarkContext) => {
  const data = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    value: Math.random(),
    computed: Math.sin(i) * Math.cos(i)
  }));

  return ctx.json({
    message: 'Heavy plugin chain completed',
    plugins: ['cors', 'logger', 'json', 'errorHandler', 'rateLimit', 'auth'],
    data: data.slice(0, 5),
    totalItems: data.length,
    user: ctx.user,
    timestamp: new Date().toISOString()
  });
});

// Plugin performance test
app.get('/plugin-performance', (ctx: BenchmarkContext) => {
  const iterations = parseInt(ctx.getQuery('iterations') || '1000');

  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sin(i) * Math.cos(i);
  }

  return ctx.json({
    message: 'Plugin performance test',
    iterations,
    result,
    plugins: ['cors', 'logger'],
    timestamp: new Date().toISOString()
  });
});

// Dynamic plugin simulation
app.get('/dynamic-plugins', (ctx: BenchmarkContext) => {
  const enabledPlugins = ctx.getQuery('plugins')?.split(',') || ['cors'];

  return ctx.json({
    message: 'Dynamic plugins applied',
    requested: enabledPlugins,
    applied: enabledPlugins,
    timestamp: new Date().toISOString()
  });
});

const port = process.argv[2] || 3003;
app.listen(port, () => {
  console.log(`OpenSpeed Plugins Benchmark listening on port ${port}`);
});
