import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

// Rate limiting and account lockout (in-memory store - use Redis in production)
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

// Rate limiting and account lockout functions
export function checkRateLimit(identifier: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Clean up old entries
  for (const [key, data] of loginAttempts.entries()) {
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

export function recordFailedAttempt(identifier: string): void {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };

  attempts.count += 1;
  attempts.lastAttempt = now;

  // Lock account after max attempts
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = now + LOCKOUT_DURATION;
  }

  loginAttempts.set(identifier, attempts);
}

export function recordSuccessfulLogin(identifier: string): void {
  // Reset failed attempts on successful login
  loginAttempts.delete(identifier);
}

export function getLockoutStatus(identifier: string): {
  isLocked: boolean;
  remainingTime?: number;
} {
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
