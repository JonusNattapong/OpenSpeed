import { Openspeed } from '../../src/openspeed/index.js';
import type { Context } from '../../src/openspeed/context.js';

// Extend Context for benchmark properties
interface BenchmarkContext extends Context {
  startTime?: number;
  user?: any;
  requestId?: string;
  responseTime?: number;
  rateLimit?: any;
  compressed?: boolean;
  cached?: boolean;
  error?: any;
}

const app = Openspeed();

// Health check
app.get('/health', (ctx: Context) => {
  return ctx.json({ status: 'ok', framework: 'openspeed', scenario: 'middleware' });
});

// Simple middleware benchmark
app.use((ctx: BenchmarkContext, next: () => Promise<any>) => {
  ctx.startTime = Date.now();
  return next();
});

// Logger middleware
app.use((ctx: BenchmarkContext, next: () => Promise<any>) => {
  const start = Date.now();
  return next().then(() => {
    const duration = Date.now() - start;
    ctx.setHeader('X-Response-Time', `${duration}ms`);
  });
});

// Auth middleware
app.use((ctx: Context, next: () => Promise<any>) => {
  const auth = (ctx as BenchmarkContext).req.headers.authorization;
  if (auth === 'Bearer benchmark-token') {
    (ctx as BenchmarkContext).user = { id: 1, name: 'Benchmark User' };
  }
  return next();
});

// CORS middleware
app.use((ctx: Context, next: () => Promise<any>) => {
  ctx.res.headers = {
    ...ctx.res.headers,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  };
  return next();
});

// Request ID middleware
app.use((ctx: Context, next: () => Promise<any>) => {
  (ctx as BenchmarkContext).requestId = Math.random().toString(36).substr(2, 9);
  ctx.setHeader('X-Request-ID', (ctx as BenchmarkContext).requestId!);
  return next();
});

// Rate limiting middleware (simplified)
const requests = new Map();
app.use((ctx: Context, next: () => Promise<any>) => {
  const ip = '127.0.0.1'; // Simplified for benchmark
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  if (!requests.has(ip)) {
    requests.set(ip, []);
  }

  const userRequests = requests.get(ip).filter((time: number) => time > windowStart);
  userRequests.push(now);
  requests.set(ip, userRequests);

  (ctx as BenchmarkContext).rateLimit = {
    remaining: Math.max(0, 100 - userRequests.length),
    reset: windowStart + 60000,
  };

  return next();
});

// Compression middleware (simulated)
app.use((ctx: Context, next: () => Promise<any>) => {
  return next().then(() => {
    const responseSize = JSON.stringify(ctx.res.body).length;
    if (responseSize > 1024) {
      ctx.res.headers['content-encoding'] = 'gzip';
      (ctx as BenchmarkContext).compressed = true;
    }
  });
});

// Cache middleware
const cache = new Map();
app.use((ctx: Context, next: () => Promise<any>) => {
  const key = `${ctx.req.method}:${ctx.req.url}`;
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < 30000) {
    // 30 second cache
    (ctx as BenchmarkContext).cached = true;
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

// Error handling middleware
app.use((ctx: Context, next: () => Promise<any>) => {
  return next().catch((error: any) => {
    (ctx as BenchmarkContext).error = error;
    return ctx.json(
      {
        error: 'Internal Server Error',
        message: error.message,
        requestId: (ctx as BenchmarkContext).requestId,
      },
      500
    );
  });
});

// Response time header middleware
app.use((ctx: Context, next: () => Promise<any>) => {
  return next().then(() => {
    if ((ctx as BenchmarkContext).responseTime) {
      ctx.setHeader('X-Response-Time', `${(ctx as BenchmarkContext).responseTime}ms`);
    }
  });
});

// Benchmark endpoint with all middleware
app.get('/middleware', (ctx: Context) => {
  return ctx.json({
    message: 'All middleware executed successfully',
    requestId: (ctx as BenchmarkContext).requestId,
    user: (ctx as BenchmarkContext).user,
    rateLimit: (ctx as BenchmarkContext).rateLimit,
    cached: (ctx as BenchmarkContext).cached || false,
    compressed: (ctx as BenchmarkContext).compressed || false,
    responseTime: (ctx as BenchmarkContext).responseTime,
    startTime: (ctx as BenchmarkContext).startTime,
    middleware: {
      auth: !!(ctx as BenchmarkContext).user,
      cors: !!ctx.getHeader('Access-Control-Allow-Origin'),
      rateLimit: !!(ctx as BenchmarkContext).rateLimit,
      cache: (ctx as BenchmarkContext).cached || false,
      compression: (ctx as BenchmarkContext).compressed || false,
      error: !!ctx.error,
    },
  });
});

// Light middleware endpoint
app.get('/light', (ctx: Context) => {
  return ctx.json({
    message: 'Light middleware test',
    requestId: ctx.requestId,
    timestamp: Date.now(),
  });
});

// Heavy middleware endpoint
app.get(
  '/heavy',
  (ctx: Context, next: () => Promise<any>) => {
    // Simulate heavy processing
    const data = [];
    for (let i = 0; i < 10000; i++) {
      data.push({
        id: i,
        value: Math.random(),
        computed: Math.sin(i) * Math.cos(i),
      });
    }

    ctx.processedData = data;
    return next();
  },
  (ctx: Context) => {
    return ctx.json({
      message: 'Heavy middleware processing completed',
      dataLength: ctx.processedData.length,
      sample: ctx.processedData.slice(0, 5),
      requestId: ctx.requestId,
    });
  }
);

// Conditional middleware
app.use('/conditional/*', (ctx: Context, next: () => Promise<any>) => {
  const shouldProcess = Math.random() > 0.5;
  ctx.conditional = shouldProcess;

  if (shouldProcess) {
    // Add extra processing
    ctx.extraData = {
      processed: true,
      randomValue: Math.random(),
      timestamp: Date.now(),
    };
  }

  return next();
});

app.get('/conditional/test', (ctx: Context) => {
  return ctx.json({
    conditional: ctx.conditional,
    extraData: ctx.extraData,
    requestId: ctx.requestId,
  });
});

// Async middleware
app.use('/async/*', async (ctx: Context, next: () => Promise<any>) => {
  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, 1));
  ctx.asyncProcessed = true;
  ctx.asyncTimestamp = Date.now();
  return next();
});

app.get('/async/test', (ctx: Context) => {
  return ctx.json({
    asyncProcessed: ctx.asyncProcessed,
    asyncTimestamp: ctx.asyncTimestamp,
    requestId: ctx.requestId,
  });
});

const port = process.argv[2] || '3002';
app.listen(port, () => {
  console.log(`OpenSpeed Middleware Benchmark listening on port ${port}`);
});
