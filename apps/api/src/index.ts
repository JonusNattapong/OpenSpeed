/// <reference path="../../../src/openspeed/runtime-globals.d.ts" />
import { createApp } from '../../../src/openspeed/index.js';
import { openapi } from '../../../src/openspeed/plugins/openapi.js';
import { rateLimit } from '../../../src/openspeed/plugins/rateLimit.js';
import { errorHandler } from '../../../src/openspeed/plugins/errorHandler.js';
import { logger } from '../../../src/openspeed/plugins/logger.js';
import { cors } from '../../../src/openspeed/plugins/cors.js';
import { json } from '../../../src/openspeed/plugins/json.js';
import { validate } from '../../../src/openspeed/plugins/validate.js';
import { static as staticPlugin } from '../../../src/openspeed/plugins/static.js';
import { prisma } from '../../../packages/db/src/index.js';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, verifyAccessToken } from '../../../packages/auth/src/index.js';
import { createUserSchema, loginSchema, createPostSchema, userSchema, postSchema } from '../../../packages/types/src/index.js';
import * as Sentry from '@sentry/node';
import { collectDefaultMetrics, register, Gauge } from 'prom-client';

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
});

// Prometheus metrics
collectDefaultMetrics();
const httpRequestsTotal = new Gauge({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

// Middleware for request ID
function requestId() {
  return async (ctx: any, next: () => Promise<any>) => {
    const id = Math.random().toString(36).substr(2, 9);
    ctx.requestId = id;
    ctx.res.headers = { ...ctx.res.headers, 'x-request-id': id };
    await next();
  };
}

// Middleware for Prometheus metrics
function metrics() {
  return async (ctx: any, next: () => Promise<any>) => {
    await next();
    httpRequestsTotal.set({ method: ctx.req.method, route: ctx.req.url, status: ctx.res.status }, 1);
  };
}

// Auth middleware
function auth() {
  return async (ctx: any, next: () => Promise<any>) => {
    const authHeader = ctx.req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ctx.res.status = 401;
      ctx.res.body = { code: 'UNAUTHORIZED', message: 'Missing or invalid token' };
      return;
    }
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    if (!payload) {
      ctx.res.status = 401;
      ctx.res.body = { code: 'UNAUTHORIZED', message: 'Invalid token' };
      return;
    }
    ctx.user = payload;
    await next();
  };
}

const app = createApp();

// Global middleware
app.use(requestId());
app.use(metrics());
app.use(logger());
app.use(cors());
app.use(json());
app.use(errorHandler());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })); // 100 requests per 15 minutes
app.use(staticPlugin({ root: './public' }));

// OpenAPI
const api = openapi({ title: 'OpenSpeed API', version: '1.0.0' });
app.use(api.middleware);

// File-based routes loader (loads files from ./routes)
// exports in route files should be named GET/POST/PUT/DELETE/PATCH/OPTIONS
await app.loadRoutes('./routes');

// Routes
app.get('/', (ctx: any) => {
  return ctx.json({ message: 'Welcome to OpenSpeed API', version: '1.0.0' });
});

// Auth routes
app.post('/auth/register', validate({ body: createUserSchema }), async (ctx: any) => {
  const { name, email, password } = ctx.body;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return ctx.json({ code: 'USER_EXISTS', message: 'User already exists' }, 400);
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
  });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

  return ctx.json({
    user,
    accessToken,
    refreshToken,
  });
});

app.post('/auth/login', validate({ body: loginSchema }), async (ctx: any) => {
  const { email, password } = ctx.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return ctx.json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }, 401);
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return ctx.json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }, 401);
  }

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

  return ctx.json({
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
  });
});

// User routes (protected)
app.get('/users/me', auth(), async (ctx: any) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.user.userId },
    select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
  });
  return ctx.json(user);
});

// Post routes
app.get('/posts', async (ctx: any) => {
  const posts = await prisma.post.findMany({
    where: { published: true },
    include: { author: { select: { name: true } } },
  });
  return ctx.json(posts);
});

app.post('/posts', auth(), validate({ body: createPostSchema }), async (ctx: any) => {
  const { title, content, published } = ctx.body;
  const post = await prisma.post.create({
    data: { title, content, published, authorId: ctx.user.userId },
  });
  return ctx.json(post);
});

app.get('/posts/:id', async (ctx: any) => {
  const post = await prisma.post.findUnique({
    where: { id: ctx.params.id },
    include: { author: { select: { name: true } } },
  });
  if (!post) {
    return ctx.json({ code: 'NOT_FOUND', message: 'Post not found' }, 404);
  }
  return ctx.json(post);
});

// Metrics endpoint
app.get('/metrics', async (ctx: any) => {
  const metrics = await register.metrics();
  ctx.res.headers = { ...ctx.res.headers, 'content-type': register.contentType };
  ctx.res.body = metrics;
});

// OpenAPI spec
app.get('/openapi.json', api.middleware);

await app.listen(3000);