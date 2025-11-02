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
import { security } from '../../../src/openspeed/plugins/security.js';
import { database, healthCheck } from '../../../src/openspeed/plugins/database.js';
import { prisma } from '../../../packages/db/src/index.js';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessTokenWithRotation,
  verifyRefreshTokenWithRotation,
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulLogin,
  getLockoutStatus,
  validateSecrets,
  autoRotateKeys,
  getCurrentSecrets,
} from '../../../packages/auth/src/index.js';
import { z } from 'zod';
import {
  createUserSchema,
  loginSchema,
  createPostSchema,
} from '../../../packages/types/src/index.js';
import * as Sentry from '@sentry/node';
import nodemailer from 'nodemailer';
import { collectDefaultMetrics, register, Gauge, Counter } from 'prom-client';

/**
 * ENV validation - fail fast and provide clear errors.
 * Use zod to validate required environment variables and types.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  DB_ENCRYPTION_KEY: z.string().optional(),
  DB_AUDIT_LOG: z.enum(['true', 'false']).optional(),
  ENABLE_SECURITY_ALERTS: z.enum(['true', 'false']).optional(),
  ALERT_EMAIL: z.string().email().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ALERT_FAILED_LOGINS_PER_HOUR: z.string().optional(),
  ALERT_SUSPICIOUS_UPLOADS_PER_HOUR: z.string().optional(),
  ALERT_DB_ANOMALIES_PER_HOUR: z.string().optional(),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().optional(),
  EMAIL_SECURE: z.enum(['true', 'false']).optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  CSRF_SECRET: z.string().min(16).optional(),
  API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  FRONTEND_URL: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
});

const parsedEnv = EnvSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error('[ENV] Invalid environment configuration:');
  console.error(parsedEnv.error.format());
  // Fail fast to avoid running with insecure defaults
  process.exit(1);
}
const env = parsedEnv.data;

// Disallow default DB credentials. In production DATABASE_URL must be set.
const isProduction = env.NODE_ENV === 'production';
const databaseUrl = env.DATABASE_URL;
if (!databaseUrl && isProduction) {
  console.error('[ENV] DATABASE_URL is required in production. Aborting startup.');
  process.exit(1);
}

// Allow a safe local-only fallback when not in production (no credentials embedded).
const safeLocalDbUrl = databaseUrl || 'postgresql://localhost:5432/openspeed';

// Database configuration with security (no hardcoded credentials)
const dbConfig = {
  type: 'postgresql' as const,
  connection: safeLocalDbUrl,
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
  },
  encryptionKey: process.env.DB_ENCRYPTION_KEY,
  enableQueryLogging: env.NODE_ENV === 'development',
  enableAuditLog: env.DB_AUDIT_LOG === 'true',
  maxQueryTime: 30000,
};

// Monitoring config
const monitoringConfig = {
  enableAlerts: env.ENABLE_SECURITY_ALERTS === 'true',
  alertEmail: env.ALERT_EMAIL,
  alertWebhook: env.ALERT_WEBHOOK_URL,
  alertThresholds: {
    failedLoginsPerHour: parseInt(env.ALERT_FAILED_LOGINS_PER_HOUR || '10'),
    suspiciousUploadsPerHour: parseInt(
      env.ALERT_SUSPICION_UPLOADS_PER_HOUR || env.ALERT_SUSPICIOUS_UPLOADS_PER_HOUR || '5'
    ),
    dbAnomaliesPerHour: parseInt(env.ALERT_DB_ANOMALIES_PER_HOUR || '3'),
  },
};

// Email configuration - keep auth optional; validateEnv ensures values are sane
const emailConfig = {
  host: env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(env.EMAIL_PORT || '587'),
  secure: env.EMAIL_SECURE === 'true',
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
};

// Nodemailer transporter - will throw if config invalid at send time
const transporter = nodemailer.createTransport(emailConfig);

// Send email helper
async function sendEmail(to: string, subject: string, html: string, text?: string) {
  try {
    const mailOptions = {
      from: env.EMAIL_FROM || emailConfig.auth.user,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL] Failed to send to ${to}:`, error);
    return { success: false, error };
  }
}

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
    ip: clientIP,
    userAgent: ctx?.req.headers.get('user-agent') || 'unknown',
    event,
    details,
  };

  // Use structured logging
  console.log(`[AUDIT] ${JSON.stringify(auditEntry)}`);

  // Security event monitoring
  monitorSecurityEvent(event, auditEntry);

  // In production, this should be persisted to a tamper-evident store (DB or external logging)
}

// Initialize Sentry (optional)
Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV || 'development',
});

// Prometheus metrics
collectDefaultMetrics();
const httpRequestsTotal = new Gauge({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const securityEventsTotal = new Counter({
  name: 'security_events_total',
  help: 'Total number of security events',
  labelNames: ['type', 'severity'],
});

const failedLoginsTotal = new Counter({
  name: 'failed_logins_total',
  help: 'Total number of failed login attempts',
  labelNames: ['reason'],
});

// Security alerting functions
async function sendSecurityAlert(
  event: string,
  details: any,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) {
  if (!monitoringConfig.enableAlerts) return;

  const alertData = {
    timestamp: new Date().toISOString(),
    event,
    severity,
    details,
    source: 'OpenSpeed API',
  };

  console.log(`[ALERT] ${severity.toUpperCase()}: ${event}`, details);

  if (monitoringConfig.alertEmail) {
    try {
      await sendEmail(
        monitoringConfig.alertEmail,
        `Security Alert: ${event}`,
        `Security event detected:\n\nEvent: ${event}\nSeverity: ${severity}\nDetails: ${JSON.stringify(details, null, 2)}\nTimestamp: ${alertData.timestamp}`
      );
    } catch (error) {
      console.error('[ALERT] Failed to send email alert:', error);
    }
  }

  if (monitoringConfig.alertWebhook) {
    try {
      const response = await fetch(monitoringConfig.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData),
      });
      if (!response.ok) {
        console.error('[ALERT] Webhook alert failed:', response.status);
      }
    } catch (error) {
      console.error('[ALERT] Failed to send webhook alert:', error);
    }
  }
}

function monitorSecurityEvent(event: string, auditEntry: any) {
  securityEventsTotal.inc({ type: event, severity: getEventSeverity(event) });
  checkAlertThresholds(event, auditEntry);
}

function getEventSeverity(event: string): string {
  const criticalEvents = ['MALWARE_DETECTED', 'BRUTE_FORCE_ATTACK', 'SQL_INJECTION_ATTEMPT'];
  const highEvents = ['ACCOUNT_LOCKED', 'SUSPICIOUS_UPLOAD', 'UNAUTHORIZED_ACCESS'];
  const mediumEvents = ['FAILED_LOGIN', 'RATE_LIMIT_EXCEEDED'];

  if (criticalEvents.includes(event)) return 'critical';
  if (highEvents.includes(event)) return 'high';
  if (mediumEvents.includes(event)) return 'medium';
  return 'low';
}

async function checkAlertThresholds(event: string, auditEntry: any) {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;

  if (!global.securityEventCounts) {
    global.securityEventCounts = new Map();
  }

  const eventKey = `${event}:${Math.floor(now / (60 * 60 * 1000))}`;
  const currentCount = (global.securityEventCounts.get(eventKey) || 0) + 1;
  global.securityEventCounts.set(eventKey, currentCount);

  for (const [key] of global.securityEventCounts.entries()) {
    const [, timestamp] = key.split(':');
    if (parseInt(timestamp) * 60 * 60 * 1000 < hourAgo) {
      global.securityEventCounts.delete(key);
    }
  }

  if (
    event === 'LOGIN_FAILED' &&
    currentCount >= monitoringConfig.alertThresholds.failedLoginsPerHour
  ) {
    await sendSecurityAlert(
      'BRUTE_FORCE_ATTACK',
      {
        eventCount: currentCount,
        timeWindow: '1 hour',
        lastEvent: auditEntry,
      },
      'high'
    );
  }

  if (
    event === 'MALWARE_DETECTED' &&
    currentCount >= monitoringConfig.alertThresholds.suspiciousUploadsPerHour
  ) {
    await sendSecurityAlert(
      'MALWARE_OUTBREAK',
      {
        eventCount: currentCount,
        timeWindow: '1 hour',
        lastEvent: auditEntry,
      },
      'critical'
    );
  }

  if (
    event === 'DB_ANOMALY' &&
    currentCount >= monitoringConfig.alertThresholds.dbAnomaliesPerHour
  ) {
    await sendSecurityAlert(
      'DATABASE_ATTACK',
      {
        eventCount: currentCount,
        timeWindow: '1 hour',
        lastEvent: auditEntry,
      },
      'high'
    );
  }
}

// Middleware helpers
function requestId() {
  return async (ctx: any, next: () => Promise<any>) => {
    const id = Math.random().toString(36).substr(2, 9);
    ctx.requestId = id;
    ctx.res.headers = { ...ctx.res.headers, 'x-request-id': id };
    await next();
  };
}

function metrics() {
  return async (ctx: any, next: () => Promise<any>) => {
    await next();
    httpRequestsTotal.set(
      { method: ctx.req.method, route: ctx.req.url, status: ctx.res.status },
      1
    );
  };
}

// Auth middleware (verifies token and attaches user)
function auth() {
  return async (ctx: any, next: () => Promise<any>) => {
    const authHeader = ctx.req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ctx.res.status = 401;
      ctx.res.body = { code: 'UNAUTHORIZED', message: 'Missing or invalid token' };
      return;
    }
    const token = authHeader.substring(7);
    const payload = verifyAccessTokenWithRotation(token);
    if (!payload) {
      ctx.res.status = 401;
      ctx.res.body = { code: 'UNAUTHORIZED', message: 'Invalid token' };
      return;
    }
    ctx.user = payload;
    await next();
  };
}

/**
 * requireAdmin middleware
 * - Prefer role-based check (ctx.user.role === 'admin')
 * - Fallback to ADMIN_EMAIL env var only if role is missing (still safer than open checks)
 */
function requireAdmin() {
  return async (ctx: any, next: () => Promise<any>) => {
    if (!ctx.user) {
      ctx.res.status = 401;
      ctx.res.body = { code: 'UNAUTHORIZED', message: 'Authentication required' };
      return;
    }

    // Prefer role-based authorization (recommended)
    if (ctx.user.role && ctx.user.role === 'admin') {
      await next();
      return;
    }

    // Fallback to admin email check if role is not present
    if (env.ADMIN_EMAIL && ctx.user.email && ctx.user.email === env.ADMIN_EMAIL) {
      await next();
      return;
    }

    auditLog('UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT', { user: ctx.user, path: ctx.req.url }, ctx);
    ctx.res.status = 403;
    ctx.res.body = { code: 'FORBIDDEN', message: 'Admin access required' };
  };
}

const app = createApp();

// Security middleware (must be first)
app.use(
  security({
    contentSecurityPolicy: "default-src 'self'; script-src 'self'",
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    csrf: { secret: process.env.CSRF_SECRET },
    sanitizeInput: true,
    maxBodySize: 1024 * 1024, // 1MB
    logSecurityEvents: true,
    customChecks: [
      async (ctx) => {
        // API key validation for additional endpoints
        const apiKey = ctx.req.headers.get('x-api-key');
        if (apiKey && apiKey !== process.env.API_KEY) {
          return { error: 'Invalid API key', status: 401 };
        }
        return true;
      },
    ],
  })
);

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
await app.loadRoutes('./routes');

// Database middleware
app.use(database('main-db', dbConfig));

// Health check
app.get('/health', async (ctx: any) => {
  const dbHealth = await healthCheck('main-db');
  const status = dbHealth.status === 'healthy' ? 200 : 503;

  return ctx.json(
    {
      status: dbHealth.status,
      database: dbHealth,
      timestamp: new Date().toISOString(),
    },
    status
  );
});

// Root
app.get('/', (ctx: any) => {
  return ctx.json({ message: 'Welcome to OpenSpeed API', version: '1.0.0' });
});

// Auth routes
app.post('/auth/register', validate({ body: createUserSchema }), async (ctx: any) => {
  const { name, email, password } = ctx.body;

  const clientIP =
    ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ctx.req.headers.get('x-real-ip') ||
    ctx.req.headers.get('cf-connecting-ip') ||
    'unknown';
  const rateLimitCheck = await checkRateLimit(`register:${clientIP}`);
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
    await recordFailedAttempt(`register:${clientIP}`);
    auditLog('REGISTRATION_FAILED_USER_EXISTS', { email, clientIP }, ctx);
    return ctx.json({ code: 'USER_EXISTS', message: 'User already exists' }, 400);
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true, email: true, name: true }, // Exclude sensitive timestamps
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

  const clientIP =
    ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ctx.req.headers.get('x-real-ip') ||
    ctx.req.headers.get('cf-connecting-ip') ||
    'unknown';

  const rateLimitCheck = await checkRateLimit(`login:${clientIP}`);
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

  const lockoutStatus = await getLockoutStatus(email.toLowerCase());
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

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, password: true, name: true, role: true }, // include role for later
  });

  const isValidPassword = user ? await verifyPassword(password, user.password) : false;

  if (!user || !isValidPassword) {
    await recordFailedAttempt(email.toLowerCase());
    await recordFailedAttempt(`login:${clientIP}`);
    auditLog(
      'LOGIN_FAILED',
      { email, clientIP, reason: user ? 'INVALID_PASSWORD' : 'USER_NOT_FOUND' },
      ctx
    );
    failedLoginsTotal.inc({ reason: 'invalid_credentials' });
    return ctx.json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }, 401);
  }

  await recordSuccessfulLogin(email.toLowerCase());
  await recordSuccessfulLogin(`login:${clientIP}`);

  auditLog('LOGIN_SUCCESSFUL', { userId: user.id, email, clientIP }, ctx);
  failedLoginsTotal.reset();

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

  return ctx.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
  });
});

// Refresh token endpoint
app.post('/auth/refresh', async (ctx: any) => {
  const authHeader = ctx.req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    auditLog('REFRESH_TOKEN_INVALID_FORMAT', { reason: 'Missing or invalid Bearer token' }, ctx);
    securityEventsTotal.inc({ type: 'invalid_token', severity: 'low' });
    return ctx.json({ code: 'INVALID_TOKEN', message: 'Refresh token required' }, 401);
  }

  const refreshToken = authHeader.substring(7);
  const payload = verifyRefreshTokenWithRotation(refreshToken);

  if (!payload) {
    auditLog('REFRESH_TOKEN_INVALID', { reason: 'Token verification failed' }, ctx);
    securityEventsTotal.inc({ type: 'invalid_token', severity: 'medium' });
    return ctx.json({ code: 'INVALID_TOKEN', message: 'Invalid refresh token' }, 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    auditLog('REFRESH_TOKEN_USER_NOT_FOUND', { userId: payload.userId, email: payload.email }, ctx);
    securityEventsTotal.inc({ type: 'user_not_found', severity: 'medium' });
    return ctx.json({ code: 'USER_NOT_FOUND', message: 'User not found' }, 401);
  }

  const newAccessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  const newRefreshToken = generateRefreshToken({ userId: user.id, email: user.email });

  auditLog('TOKEN_REFRESHED', { userId: user.id, email: user.email }, ctx);

  return ctx.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

app.post('/auth/logout', auth(), async (ctx: any) => {
  auditLog('USER_LOGOUT', { userId: ctx.user.userId, email: ctx.user.email }, ctx);

  return ctx.json({
    message: 'Logged out successfully',
  });
});

// Email verification endpoints (unchanged)
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

  const verificationToken = require('crypto').randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationExpires,
    },
  });

  const verificationUrl = `${env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
  const emailHtml = `
    <h1>Email Verification</h1>
    <p>Please click the link below to verify your email address:</p>
    <a href="${verificationUrl}">Verify Email</a>
    <p>This link will expire in 24 hours.</p>
  `;
  await sendEmail(user.email, 'Verify Your Email', emailHtml);

  auditLog('VERIFICATION_EMAIL_SENT', { userId: user.id, email: user.email }, ctx);

  return ctx.json({
    message: 'Verification email sent. Please check your inbox.',
  });
});

app.post(
  '/auth/verify-email',
  validate({
    body: z.object({
      token: z.string().min(1, 'Verification token is required'),
    }),
  }),
  async (ctx: any) => {
    const { token } = ctx.body;

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationExpires: {
          gt: new Date(),
        },
      },
      select: { id: true, email: true },
    });

    if (!user) {
      auditLog('EMAIL_VERIFICATION_FAILED', { token, reason: 'Invalid or expired token' }, ctx);
      return ctx.json(
        { code: 'INVALID_TOKEN', message: 'Invalid or expired verification token' },
        400
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
      },
    });

    auditLog('EMAIL_VERIFIED', { userId: user.id, email: user.email }, ctx);

    return ctx.json({
      message: 'Email verified successfully',
    });
  }
);

// Change password
app.post(
  '/auth/change-password',
  auth(),
  validate({
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: createUserSchema.shape.password,
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

    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      auditLog(
        'PASSWORD_CHANGE_FAILED',
        { userId: user.id, email: user.email, reason: 'INVALID_CURRENT_PASSWORD' },
        ctx
      );
      return ctx.json({ code: 'INVALID_PASSWORD', message: 'Current password is incorrect' }, 400);
    }

    const hashedNewPassword = await hashPassword(newPassword);

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

// User routes
app.get('/users/me', auth(), async (ctx: any) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.user.userId },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return ctx.json({ code: 'USER_NOT_FOUND', message: 'User not found' }, 404);
  }

  return ctx.json(user);
});

// Password reset: forgot/reset endpoints (unchanged behavior)
app.post(
  '/auth/forgot-password',
  validate({
    body: z.object({ email: z.string().email() }),
  }),
  async (ctx: any) => {
    const { email } = ctx.body;

    const clientIP =
      ctx.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      ctx.req.headers.get('x-real-ip') ||
      ctx.req.headers.get('cf-connecting-ip') ||
      'unknown';
    const rateLimitCheck = await checkRateLimit(`forgot-password:${clientIP}`);
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

    if (user) {
      const resetToken = require('crypto').randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetExpires,
        },
      });

      const resetUrl = `${env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      const emailHtml = `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `;
      await sendEmail(user.email, 'Password Reset Request', emailHtml);

      auditLog('PASSWORD_RESET_EMAIL_SENT', { userId: user.id, email: user.email }, ctx);
    }

    return ctx.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
);

app.post(
  '/auth/reset-password',
  validate({
    body: z.object({
      token: z.string().min(1, 'Reset token is required'),
      newPassword: createUserSchema.shape.password,
    }),
  }),
  async (ctx: any) => {
    const { token, newPassword } = ctx.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetExpires: {
          gt: new Date(),
        },
      },
      select: { id: true, email: true },
    });

    if (!user) {
      auditLog('PASSWORD_RESET_FAILED', { token, reason: 'Invalid or expired token' }, ctx);
      return ctx.json({ code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' }, 400);
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
        resetToken: null,
        resetExpires: null,
      },
    });

    auditLog('PASSWORD_RESET_SUCCESSFUL', { userId: user.id, email: user.email }, ctx);

    return ctx.json({
      message: 'Password reset successfully',
    });
  }
);

// Posts
app.get('/posts', async (ctx: any) => {
  const posts = await prisma.post.findMany({
    where: { published: true },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return ctx.json(posts);
});

app.post('/posts', auth(), validate({ body: createPostSchema }), async (ctx: any) => {
  const { title, content, published } = ctx.body;

  if (content && content.length > 10000) {
    return ctx.json({ code: 'CONTENT_TOO_LONG', message: 'Content exceeds maximum length' }, 400);
  }

  const post = await prisma.post.create({
    data: { title, content, published, authorId: ctx.user.userId },
    include: { author: { select: { name: true } } },
  });
  return ctx.json(post);
});

app.get('/posts/:id', async (ctx: any) => {
  const id = ctx.params.id;
  if (!id || typeof id !== 'string' || id.length > 100) {
    return ctx.json({ code: 'INVALID_ID', message: 'Invalid post ID' }, 400);
  }

  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: { select: { name: true } } },
  });

  if (!post) {
    return ctx.json({ code: 'NOT_FOUND', message: 'Post not found' }, 404);
  }

  if (!post.published && (!ctx.user || ctx.user.userId !== post.authorId)) {
    return ctx.json({ code: 'FORBIDDEN', message: 'Access denied' }, 403);
  }

  return ctx.json(post);
});

// Metrics
app.get('/metrics', async (ctx: any) => {
  const metrics = await register.metrics();
  ctx.res.headers = { ...ctx.res.headers, 'content-type': register.contentType };
  ctx.res.body = metrics;
});

// Admin: security status - protected by requireAdmin middleware
app.get('/admin/security-status', auth(), requireAdmin(), async (ctx: any) => {
  const status = {
    secretsValidation: validateSecrets(), // returns metadata but should not include secret values
    keyRotationStatus: {
      lastRotation: null,
      activeKeys: [], // do not include key material
    },
    monitoringConfig,
    recentAlerts: [], // implement persistent storage for recent alerts
  };

  return ctx.json(status);
});

// Validate secrets on startup (validateSecrets should not expose secret material)
const secretsValidation = validateSecrets();
if (!secretsValidation.valid) {
  console.error('[API] Secrets validation failed:');
  secretsValidation.errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

if (secretsValidation.warnings.length > 0) {
  console.warn('[API] Secrets validation warnings:');
  secretsValidation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
}

// Auto-rotate keys periodically (every 24 hours) - log rotation metadata only
setInterval(
  () => {
    const rotation = autoRotateKeys();
    if (rotation.jwtRotated || rotation.dbRotated || rotation.csrfRotated) {
      console.log('[API] Keys auto-rotated:', {
        jwtRotated: rotation.jwtRotated,
        dbRotated: rotation.dbRotated,
        csrfRotated: rotation.csrfRotated,
        timestamp: new Date().toISOString(),
      });
    }
  },
  24 * 60 * 60 * 1000
);

// Admin: manual key rotation - protected and does NOT return secret material
app.post('/admin/rotate-keys', auth(), requireAdmin(), async (ctx: any) => {
  const rotation = autoRotateKeys();
  auditLog('KEY_ROTATION_MANUAL', { userId: ctx.user.userId, rotation }, ctx);

  return ctx.json({
    message: 'Keys rotated successfully',
    rotation: {
      jwtRotated: rotation.jwtRotated,
      dbRotated: rotation.dbRotated,
      csrfRotated: rotation.csrfRotated,
    },
    // Intentionally do not return getCurrentSecrets() or any secret values
  });
});

// OpenAPI spec
app.get('/openapi.json', api.middleware);

// Start server
await app.listen(3000);
