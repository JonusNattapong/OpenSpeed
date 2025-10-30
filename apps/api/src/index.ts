import { createApp } from 'openspeed-framework';
import { openapi } from 'openspeed-framework/plugins/openapi';
import { rateLimit } from 'openspeed-framework/plugins/rateLimit';
import { errorHandler } from 'openspeed-framework/plugins/errorHandler';
import { logger } from 'openspeed-framework/plugins/logger';
import { cors } from 'openspeed-framework/plugins/cors';
import { json } from 'openspeed-framework/plugins/json';
import { validate } from 'openspeed-framework/plugins/validate';
import { static as staticPlugin } from 'openspeed-framework/plugins/static';
import { helmet } from 'openspeed-framework/plugins/helmet';
import { prisma } from '@openspeed/db';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, verifyAccessToken } from '@openspeed/auth';
import { createUserSchema, loginSchema, createPostSchema, userSchema, postSchema } from '@openspeed/types';
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
app.use(helmet());
app.use(json());
app.use(errorHandler());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })); // 100 requests per 15 minutes
app.use(staticPlugin({ root: './public' }));

// OpenAPI
const api = openapi({ title: 'OpenSpeed API', version: '1.0.0' });
app.use(api.middleware);

// Routes
app.get('/', (ctx) => {
  return ctx.json({ message: 'Welcome to OpenSpeed API', version: '1.0.0' });
});

// Auth routes
app.post('/auth/register', validate(createUserSchema), async (ctx) => {
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

app.post('/auth/login', validate(loginSchema), async (ctx) => {
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
app.get('/users/me', auth(), async (ctx) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.user.userId },
    select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
  });
  return ctx.json(user);
});

// Post routes
app.get('/posts', async (ctx) => {
  const posts = await prisma.post.findMany({
    where: { published: true },
    include: { author: { select: { name: true } } },
  });
  return ctx.json(posts);
});

app.post('/posts', auth(), validate(createPostSchema), async (ctx) => {
  const { title, content, published } = ctx.body;
  const post = await prisma.post.create({
    data: { title, content, published, authorId: ctx.user.userId },
  });
  return ctx.json(post);
});

app.get('/posts/:id', async (ctx) => {
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
app.get('/metrics', async (ctx) => {
  const metrics = await register.metrics();
  ctx.res.headers = { ...ctx.res.headers, 'content-type': register.contentType };
  ctx.res.body = metrics;
});

// OpenAPI spec
app.get('/openapi.json', api.middleware);

await app.listen(3000);