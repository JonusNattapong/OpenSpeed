// @ts-nocheck
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';

// Type declarations for missing @types
declare module 'jsonwebtoken';
declare module 'bcryptjs';

// Global type declarations for security monitoring
declare global {
  var securityEventCounts: Map<string, number>;
}

// Secrets management with rotation support
let JWT_SECRET: string = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
let JWT_REFRESH_SECRET: string =
  process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
let DB_ENCRYPTION_KEY: string = process.env.DB_ENCRYPTION_KEY || 'dev-db-key-change-in-production';
let CSRF_SECRET: string = process.env.CSRF_SECRET || 'dev-csrf-secret-change-in-production';

// Key versions for rotation
const keyVersions = new Map<string, { secret: string; created: number; expires?: number }>();

// Initialize default secrets if not provided (development only)
if (JWT_SECRET.startsWith('dev-')) {
  console.warn('[AUTH] JWT_SECRET not set, using development default');
}

if (JWT_REFRESH_SECRET.startsWith('dev-')) {
  console.warn('[AUTH] JWT_REFRESH_SECRET not set, using development default');
}

if (DB_ENCRYPTION_KEY.startsWith('dev-')) {
  console.warn('[AUTH] DB_ENCRYPTION_KEY not set, using development default');
}

if (CSRF_SECRET.startsWith('dev-')) {
  console.warn('[AUTH] CSRF_SECRET not set, using development default');
}

// Store initial keys
keyVersions.set('jwt:v1', { secret: JWT_SECRET, created: Date.now() });
keyVersions.set('refresh:v1', { secret: JWT_REFRESH_SECRET, created: Date.now() });
keyVersions.set('db:v1', { secret: DB_ENCRYPTION_KEY, created: Date.now() });
keyVersions.set('csrf:v1', { secret: CSRF_SECRET, created: Date.now() });

// Redis client for persistent storage (falls back to in-memory if Redis unavailable)
let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  redis.on('error', (err: Error) => {
    console.warn('[AUTH] Redis connection failed, falling back to in-memory:', err.message);
    redis = null;
  });
} catch {
  console.warn('[AUTH] Redis not available, using in-memory storage');
}

// Fallback in-memory store
const loginAttempts = new Map<
  string,
  { count: number; lastAttempt: number; lockedUntil?: number }
>();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 10;

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// Secrets validation and management
export function validateSecrets(): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for default development secrets
  if (JWT_SECRET?.startsWith('dev-')) {
    errors.push('JWT_SECRET is using development default - set a secure secret in production');
  }

  if (JWT_REFRESH_SECRET?.startsWith('dev-')) {
    errors.push(
      'JWT_REFRESH_SECRET is using development default - set a secure secret in production'
    );
  }

  if (DB_ENCRYPTION_KEY?.startsWith('dev-')) {
    errors.push('DB_ENCRYPTION_KEY is using development default - set a secure key in production');
  }

  if (CSRF_SECRET?.startsWith('dev-')) {
    errors.push('CSRF_SECRET is using development default - set a secure secret in production');
  }

  // Check secret strength
  if (JWT_SECRET && JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long');
  }

  if (JWT_REFRESH_SECRET && JWT_REFRESH_SECRET.length < 32) {
    warnings.push('JWT_REFRESH_SECRET should be at least 32 characters long');
  }

  if (DB_ENCRYPTION_KEY && DB_ENCRYPTION_KEY.length < 32) {
    warnings.push('DB_ENCRYPTION_KEY should be at least 32 characters long');
  }

  if (CSRF_SECRET && CSRF_SECRET.length < 32) {
    warnings.push('CSRF_SECRET should be at least 32 characters long');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// Key rotation functions
export function rotateJWTKeys(): { accessKey: string; refreshKey: string } {
  const newAccessKey = randomBytes(64).toString('hex');
  const newRefreshKey = randomBytes(64).toString('hex');

  // Store old keys for a grace period (24 hours)
  const now = Date.now();
  const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours

  keyVersions.set(`jwt:v${keyVersions.size + 1}`, {
    secret: JWT_SECRET,
    created: keyVersions.get('jwt:v1')!.created,
    expires: now + gracePeriod,
  });

  keyVersions.set(`refresh:v${keyVersions.size + 1}`, {
    secret: JWT_REFRESH_SECRET,
    created: keyVersions.get('refresh:v1')!.created,
    expires: now + gracePeriod,
  });

  // Update current keys
  JWT_SECRET = newAccessKey;
  JWT_REFRESH_SECRET = newRefreshKey;

  keyVersions.set('jwt:current', { secret: newAccessKey, created: now });
  keyVersions.set('refresh:current', { secret: newRefreshKey, created: now });

  console.log('[AUTH] JWT keys rotated successfully');
  return { accessKey: newAccessKey, refreshKey: newRefreshKey };
}

export function rotateDBEncryptionKey(): string {
  const newKey = randomBytes(64).toString('hex');

  const now = Date.now();
  const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days for DB key

  keyVersions.set(`db:v${keyVersions.size + 1}`, {
    secret: DB_ENCRYPTION_KEY,
    created: keyVersions.get('db:v1')!.created,
    expires: now + gracePeriod,
  });

  DB_ENCRYPTION_KEY = newKey;
  keyVersions.set('db:current', { secret: newKey, created: now });

  console.log('[AUTH] DB encryption key rotated successfully');
  return newKey;
}

export function rotateCSRFSecret(): string {
  const newSecret = randomBytes(64).toString('hex');

  const now = Date.now();
  const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours

  keyVersions.set(`csrf:v${keyVersions.size + 1}`, {
    secret: CSRF_SECRET,
    created: keyVersions.get('csrf:v1')!.created,
    expires: now + gracePeriod,
  });

  CSRF_SECRET = newSecret;
  keyVersions.set('csrf:current', { secret: newSecret, created: now });

  console.log('[AUTH] CSRF secret rotated successfully');
  return newSecret;
}

// Get current secrets (for other modules)
export function getCurrentSecrets(): {
  jwtSecret: string;
  jwtRefreshSecret: string;
  dbEncryptionKey: string;
  csrfSecret: string;
} {
  return {
    jwtSecret: JWT_SECRET,
    jwtRefreshSecret: JWT_REFRESH_SECRET,
    dbEncryptionKey: DB_ENCRYPTION_KEY,
    csrfSecret: CSRF_SECRET,
  };
}

// Verify token with key rotation support
export function verifyAccessTokenWithRotation(token: string): JWTPayload | null {
  // Try current key first
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    // Try previous keys during grace period
    for (const [version, keyData] of Array.from(keyVersions.entries())) {
      if (version.startsWith('jwt:v') && keyData.expires && keyData.expires > Date.now()) {
        try {
          return jwt.verify(token, keyData.secret) as JWTPayload;
        } catch {
          continue;
        }
      }
    }
    return null;
  }
}

export function verifyRefreshTokenWithRotation(token: string): JWTPayload | null {
  // Try current key first
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch {
    // Try previous keys during grace period
    for (const [version, keyData] of Array.from(keyVersions.entries())) {
      if (version.startsWith('refresh:v') && keyData.expires && keyData.expires > Date.now()) {
        try {
          return jwt.verify(token, keyData.secret) as JWTPayload;
        } catch {
          continue;
        }
      }
    }
    return null;
  }
}

// Clean up expired keys
export function cleanupExpiredKeys(): void {
  const now = Date.now();
  for (const [version, keyData] of Array.from(keyVersions.entries())) {
    if (keyData.expires && keyData.expires < now) {
      keyVersions.delete(version);
    }
  }
}

// Auto-rotate keys based on age (call this periodically)
export function autoRotateKeys(): {
  jwtRotated: boolean;
  dbRotated: boolean;
  csrfRotated: boolean;
} {
  const now = Date.now();
  const jwtAge = now - (keyVersions.get('jwt:current')?.created || 0);
  const dbAge = now - (keyVersions.get('db:current')?.created || 0);
  const csrfAge = now - (keyVersions.get('csrf:current')?.created || 0);

  const result = {
    jwtRotated: false,
    dbRotated: false,
    csrfRotated: false,
  };

  // Rotate JWT keys every 30 days
  if (jwtAge > 30 * 24 * 60 * 60 * 1000) {
    rotateJWTKeys();
    result.jwtRotated = true;
  }

  // Rotate DB key every 90 days
  if (dbAge > 90 * 24 * 60 * 60 * 1000) {
    rotateDBEncryptionKey();
    result.dbRotated = true;
  }

  // Rotate CSRF secret every 7 days
  if (csrfAge > 7 * 24 * 60 * 60 * 1000) {
    rotateCSRFSecret();
    result.csrfRotated = true;
  }

  cleanupExpiredKeys();
  return result;
}

// Rate limiting and account lockout functions
export async function checkRateLimit(
  identifier: string
): Promise<{ allowed: boolean; resetTime?: number }> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  const key = `auth:ratelimit:${identifier}`;

  if (redis) {
    try {
      // Get current attempts data
      const data = await redis.hgetall(key);
      const count = parseInt(data.count || '0');
      const lastAttempt = parseInt(data.lastAttempt || '0');
      const lockedUntil = parseInt(data.lockedUntil || '0');

      // Clean up expired entries
      if (lastAttempt < windowStart && !lockedUntil) {
        await redis.del(key);
        return { allowed: true };
      }

      // Check if account is locked
      if (lockedUntil && lockedUntil > now) {
        return { allowed: false, resetTime: lockedUntil };
      }

      // Check rate limit
      if (count >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, resetTime: lastAttempt + RATE_LIMIT_WINDOW };
      }

      return { allowed: true };
    } catch (error) {
      console.error('[AUTH] Redis error in checkRateLimit:', error);
      // Fall back to in-memory
    }
  }

  // Fallback to in-memory
  // Clean up old entries
  for (const [key, data] of Array.from(loginAttempts.entries())) {
    if (data.lastAttempt < windowStart && !data.lockedUntil) {
      loginAttempts.delete(key);
    }
  }

  const attempts = loginAttempts.get(identifier);
  if (!attempts) {
    return { allowed: true };
  }

  // Check if account is locked
  if (attempts.lockedUntil && attempts.lockedUntil > now) {
    return { allowed: false, resetTime: attempts.lockedUntil };
  }

  // Check rate limit
  if (attempts.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, resetTime: attempts.lastAttempt + RATE_LIMIT_WINDOW };
  }

  return { allowed: true };
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  const now = Date.now();
  const key = `auth:ratelimit:${identifier}`;

  if (redis) {
    try {
      const data = await redis.hgetall(key);
      let count = parseInt(data.count || '0');
      count += 1;

      const updateData: Record<string, string> = {
        count: count.toString(),
        lastAttempt: now.toString(),
      };

      // Lock account after max attempts
      if (count >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = (now + LOCKOUT_DURATION).toString();
      }

      await redis.hmset(key, updateData);
      // Set TTL to auto-expire old entries
      await redis.expire(key, Math.ceil(RATE_LIMIT_WINDOW / 1000) + 3600); // Extra hour for lockout

      return;
    } catch (error) {
      console.error('[AUTH] Redis error in recordFailedAttempt:', error);
      // Fall back to in-memory
    }
  }

  // Fallback to in-memory
  const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };

  attempts.count += 1;
  attempts.lastAttempt = now;

  // Lock account after max attempts
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = now + LOCKOUT_DURATION;
  }

  loginAttempts.set(identifier, attempts);
}

export async function recordSuccessfulLogin(identifier: string): Promise<void> {
  const key = `auth:ratelimit:${identifier}`;

  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (error) {
      console.error('[AUTH] Redis error in recordSuccessfulLogin:', error);
      // Fall back to in-memory
    }
  }

  // Fallback to in-memory
  loginAttempts.delete(identifier);
}

export async function getLockoutStatus(identifier: string): Promise<{
  isLocked: boolean;
  remainingTime?: number;
}> {
  const key = `auth:ratelimit:${identifier}`;

  if (redis) {
    try {
      const data = await redis.hgetall(key);
      const lockedUntil = parseInt(data.lockedUntil || '0');

      if (!lockedUntil) {
        return { isLocked: false };
      }

      const now = Date.now();
      if (lockedUntil > now) {
        return { isLocked: true, remainingTime: lockedUntil - now };
      }

      // Lockout expired, remove entry
      await redis.del(key);
      return { isLocked: false };
    } catch (error) {
      console.error('[AUTH] Redis error in getLockoutStatus:', error);
      // Fall back to in-memory
    }
  }

  // Fallback to in-memory
  const attempts = loginAttempts.get(identifier);
  if (!attempts || !attempts.lockedUntil) {
    return { isLocked: false };
  }

  const now = Date.now();
  if (attempts.lockedUntil > now) {
    return { isLocked: true, remainingTime: attempts.lockedUntil - now };
  }

  // Lockout expired, remove entry
  loginAttempts.delete(identifier);
  return { isLocked: false };
}

// Timing-safe string comparison to prevent timing attacks
export function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
