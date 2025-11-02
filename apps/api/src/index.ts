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
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulLogin,
  getLockoutStatus,
  timingSafeEquals,
} from '../../../packages/auth/src/index.js';
import { z } from 'zod';
import {
  createUserSchema,
  loginSchema,
  createPostSchema,
  userSchema,
  postSchema,
} from '../../../packages/types/src/index.js';
import * as Sentry from '@sentry/node';
import { collectDefaultMetrics, register, Gauge } from 'prom-client';

// Audit logging function
function auditLog(event: string, details: any, ctx?: any) {
  const timestamp = new Date().toISOString();
  const clientIP = ctx
    ? ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      ctx.req.headers.get('x-real-ip') ||
      ctx.req.headers.get('cf-connecting-ip') ||
      'unknown'
    : 'system';

  const auditEntry = {
    timestamp,
    event,
    ip: clientIP,
    userAgent: ctx?.req.headers.get('user-agent') || 'unknown',
    details,
  };

  console.log(`[AUDIT] ${JSON.stringify(auditEntry)}`);

  // In production, you would store this in a database or send to logging service
  // await prisma.auditLog.create({ data: auditEntry });
}

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
    httpRequestsTotal.set(
      { method: ctx.req.method, route: ctx.req.url, status: ctx.res.status },
      1
    );
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

  // Check rate limiting for registration
  const clientIP =
    ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ctx.req.headers.get('x-real-ip') ||
    ctx.req.headers.get('cf-connecting-ip') ||
    'unknown';
  const rateLimitCheck = checkRateLimit(`register:${clientIP}`);
  if (!rateLimitCheck.allowed) {
    auditLog('REGISTRATION_RATE_LIMIT_EXCEEDED', { email, clientIP }, ctx);
    return ctx.json(
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many registration attempts. Please try again later.',
        retryAfter: Math.ceil((rateLimitCheck.resetTime! - Date.now()) / 1000),
      },
      429
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    recordFailedAttempt(`register:${clientIP}`);
    auditLog('REGISTRATION_FAILED_USER_EXISTS', { email, clientIP }, ctx);
    return ctx.json({ code: 'USER_EXISTS', message: 'User already exists' }, 400);
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, email: true, name: true },
  });

  auditLog('USER_REGISTERED', { userId: user.id, email, clientIP }, ctx);

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

  // Get client IP for rate limiting
  const clientIP =
    ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ctx.req.headers.get('x-real-ip') ||
    ctx.req.headers.get('cf-connecting-ip') ||
    'unknown';

  // Check rate limiting
  const rateLimitCheck = checkRateLimit(`login:${clientIP}`);
  if (!rateLimitCheck.allowed) {
    auditLog('LOGIN_RATE_LIMIT_EXCEEDED', { email, clientIP }, ctx);
    return ctx.json(
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please try again later.',
        retryAfter: Math.ceil((rateLimitCheck.resetTime! - Date.now()) / 1000),
      },
      429
    );
  }

  // Check account lockout
  const lockoutStatus = getLockoutStatus(email.toLowerCase());
  if (lockoutStatus.isLocked) {
    auditLog('LOGIN_ACCOUNT_LOCKED', { email, clientIP }, ctx);
    return ctx.json(
      {
        code: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked due to too many failed attempts.',
        retryAfter: Math.ceil(lockoutStatus.remainingTime! / 1000),
      },
      429
    );
  }

  // Timing-safe authentication to prevent timing attacks
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Always perform password verification to prevent timing attacks
  const isValidPassword = user ? await verifyPassword(password, user.password) : false;

  if (!user || !isValidPassword) {
    recordFailedAttempt(email.toLowerCase());
    recordFailedAttempt(`login:${clientIP}`);
    auditLog(
      'LOGIN_FAILED',
      { email, clientIP, reason: user ? 'INVALID_PASSWORD' : 'USER_NOT_FOUND' },
      ctx
    );
    return ctx.json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }, 401);
  }

  // Successful login - reset failed attempts
  recordSuccessfulLogin(email.toLowerCase());
  recordSuccessfulLogin(`login:${clientIP}`);

  auditLog('LOGIN_SUCCESSFUL', { userId: user.id, email, clientIP }, ctx);

  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

  return ctx.json({
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
  });
});

// Refresh token endpoint
app.post('/auth/refresh', async (ctx: any) => {
  const authHeader = ctx.req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    auditLog('REFRESH_TOKEN_INVALID_FORMAT', { reason: 'Missing or invalid Bearer token' }, ctx);
    return ctx.json({ code: 'INVALID_TOKEN', message: 'Refresh token required' }, 401);
  }

  const refreshToken = authHeader.substring(7);
  const payload = verifyRefreshToken(refreshToken);

  if (!payload) {
    auditLog('REFRESH_TOKEN_INVALID', { reason: 'Token verification failed' }, ctx);
    return ctx.json({ code: 'INVALID_TOKEN', message: 'Invalid refresh token' }, 401);
  }

  // Verify user still exists
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    auditLog('REFRESH_TOKEN_USER_NOT_FOUND', { userId: payload.userId, email: payload.email }, ctx);
    return ctx.json({ code: 'USER_NOT_FOUND', message: 'User not found' }, 401);
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken({ userId: user.id, email: user.email });
  const newRefreshToken = generateRefreshToken({ userId: user.id, email: user.email });

  auditLog('TOKEN_REFRESHED', { userId: user.id, email: user.email }, ctx);

  return ctx.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

// Logout endpoint (client-side token invalidation)
app.post('/auth/logout', auth(), async (ctx: any) => {
  // In a real implementation, you would:
  // 1. Add the token to a blacklist
  // 2. Clear server-side sessions
  // 3. Revoke refresh tokens

  auditLog('USER_LOGOUT', { userId: ctx.user.userId, email: ctx.user.email }, ctx);

  return ctx.json({
    message: 'Logged out successfully',
  });
});

// Email verification endpoint (send verification email)
app.post('/auth/send-verification', auth(), async (ctx: any) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.user.userId },
    select: { id: true, email: true, emailVerified: true },
  });

  if (!user) {
    return ctx.json({ code: 'USER_NOT_FOUND', message: 'User not found' }, 404);
  }

  if (user.emailVerified) {
    return ctx.json({ code: 'ALREADY_VERIFIED', message: 'Email already verified' }, 400);
  }

  // Generate verification token (in production, use crypto.randomBytes)
  const verificationToken = require('crypto').randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Store verification token (in production, store in database)
  // For now, we'll just log it
  console.log(`[EMAIL] Verification token for ${user.email}: ${verificationToken}`);

  // TODO: Send verification email
  auditLog('VERIFICATION_EMAIL_SENT', { userId: user.id, email: user.email }, ctx);

  return ctx.json({
    message: 'Verification email sent. Please check your inbox.',
  });
});

// Verify email endpoint
app.post(
  '/auth/verify-email',
  validate({
    body: z.object({
      token: z.string().min(1, 'Verification token is required'),
    }),
  }),
  async (ctx: any) => {
    const { token } = ctx.body;

    // TODO: Verify token from database
    // For now, accept any token and mark as verified
    const user = await prisma.user.updateMany({
      where: {
        // In production: verificationToken: token, verificationExpires: { gt: new Date() }
      },
      data: {
        emailVerified: true,
        // verificationToken: null,
        // verificationExpires: null,
      },
    });

    if (user.count === 0) {
      auditLog('EMAIL_VERIFICATION_FAILED', { token, reason: 'Invalid or expired token' }, ctx);
      return ctx.json(
        { code: 'INVALID_TOKEN', message: 'Invalid or expired verification token' },
        400
      );
    }

    auditLog('EMAIL_VERIFIED', { token }, ctx);

    return ctx.json({
      message: 'Email verified successfully',
    });
  }
);

// Change password endpoint
app.post(
  '/auth/change-password',
  auth(),
  validate({
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: createUserSchema.shape.password, // Reuse password validation
    }),
  }),
  async (ctx: any) => {
    const { currentPassword, newPassword } = ctx.body;

    const user = await prisma.user.findUnique({
      where: { id: ctx.user.userId },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      return ctx.json({ code: 'USER_NOT_FOUND', message: 'User not found' }, 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      auditLog(
        'PASSWORD_CHANGE_FAILED',
        { userId: user.id, email: user.email, reason: 'INVALID_CURRENT_PASSWORD' },
        ctx
      );
      return ctx.json({ code: 'INVALID_PASSWORD', message: 'Current password is incorrect' }, 400);
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });

    auditLog('PASSWORD_CHANGED', { userId: user.id, email: user.email }, ctx);

    return ctx.json({
      message: 'Password changed successfully',
    });
  }
);

// User routes (protected)
app.get('/users/me', auth(), async (ctx: any) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.user.userId },
    select: { id: true, email: true, name: true }, // Remove sensitive timestamps
  });
  return ctx.json(user);
});

// Password reset endpoint (placeholder - implement proper email verification)
app.post(
  '/auth/forgot-password',
  validate({
    body: z.object({ email: z.string().email() }),
  }),
  async (ctx: any) => {
    const { email } = ctx.body;

    // Check rate limiting
    const clientIP =
      ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      ctx.req.headers.get('x-real-ip') ||
      ctx.req.headers.get('cf-connecting-ip') ||
      'unknown';
    const rateLimitCheck = checkRateLimit(`forgot-password:${clientIP}`);
    if (!rateLimitCheck.allowed) {
      return ctx.json(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many password reset requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitCheck.resetTime! - Date.now()) / 1000),
        },
        429
      );
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return success to prevent email enumeration
    if (user) {
      // TODO: Generate reset token and send email
      console.log(`[AUTH] Password reset requested for: ${email}`);
    }

    return ctx.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
);

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
