/**
 * Authentication middleware for OpenSpeed
 * 
 * ⚠️ CRITICAL SECURITY WARNING ⚠️
 * 
 * This plugin uses HMAC-SHA256 for password hashing, which is NOT suitable for production use.
 * Password hashing requires algorithms specifically designed for this purpose like bcrypt, 
 * argon2, or scrypt which include salting and are intentionally slow to resist brute-force attacks.
 * 
 * For production use, you MUST use the secure auth package from `packages/auth` which implements:
 * - Proper bcrypt password hashing (cost factor 12)
 * - Automatic key rotation
 * - Rate limiting and account lockout
 * - Timing-safe comparisons
 * - Comprehensive security features
 *
 * If you must use this plugin directly (NOT RECOMMENDED):
 * - ALWAYS set JWT secrets via environment variables (JWT_SECRET, JWT_REFRESH_SECRET)
 * - ALWAYS set PASSWORD_HASH_SALT via environment variable
 * - Use strong, cryptographically random secrets (minimum 32 characters)
 * - Never commit secrets to source code
 * - Consider migrating to bcrypt/argon2 as soon as possible
 * 
 * Migration guide:
 * 1. Install bcryptjs: npm install bcryptjs
 * 2. Import from packages/auth: import { hashPassword, verifyPassword, ... } from '../../../packages/auth/src/index.js'
 * 3. Update your auth configuration to use environment variables
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { Context } from '../context.js';

export interface JWTOptions {
  secret: string;
  expiresIn?: string;
  issuer?: string;
  audience?: string;
}

export interface AuthOptions {
  jwt?: JWTOptions;
  basic?: {
    users: Record<string, string>; // username: hashed_password
  };
  bearer?: {
    tokens: string[];
  };
  passwordHashSalt?: string; // Optional custom salt (should be from env var)
}

// Validate that secrets are properly configured
function validateAuthConfig(options: AuthOptions): void {
  if (options.jwt) {
    if (!options.jwt.secret) {
      throw new Error('[AUTH] JWT secret is required but not provided');
    }
    if (options.jwt.secret === 'openspeed-salt' || options.jwt.secret.startsWith('dev-')) {
      console.error('[AUTH SECURITY WARNING] Using development/default JWT secret in production is EXTREMELY DANGEROUS');
      console.error('[AUTH] Please set JWT_SECRET environment variable to a secure random value');
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[AUTH] Cannot use default JWT secret in production');
      }
    }
    if (options.jwt.secret.length < 32) {
      console.warn('[AUTH SECURITY WARNING] JWT secret should be at least 32 characters long');
    }
  }
  
  if (options.passwordHashSalt) {
    if (options.passwordHashSalt === 'openspeed-salt' || options.passwordHashSalt.startsWith('dev-')) {
      console.error('[AUTH SECURITY WARNING] Using hardcoded/default password salt is EXTREMELY DANGEROUS');
      console.error('[AUTH] Please set PASSWORD_HASH_SALT environment variable to a secure random value');
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[AUTH] Cannot use default password salt in production');
      }
    }
  }
}

export function auth(options: AuthOptions) {
  // Validate configuration on initialization
  validateAuthConfig(options);
  
  return async (ctx: Context, next: () => Promise<any>) => {
    const authHeader = ctx.req.headers.authorization || ctx.req.headers.Authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      ctx.res.status = 401;
      ctx.res.headers = { ...ctx.res.headers, 'WWW-Authenticate': 'Bearer' };
      ctx.res.body = JSON.stringify({ error: 'Authentication required' });
      return;
    }

    let authenticated = false;

    // JWT Authentication
    if (options.jwt && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = verifyJWT(token, options.jwt.secret);
        ctx.req.user = payload;
        authenticated = true;
      } catch (err) {
        ctx.res.status = 401;
        ctx.res.body = JSON.stringify({ error: 'Invalid token' });
        return;
      }
    }

    // Basic Authentication
    if (options.basic && authHeader.startsWith('Basic ')) {
      const credentials = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
      const [username, password] = credentials;

      // Verify hashed password using timing-safe comparison
      const expectedHash = options.basic.users[username];
      if (expectedHash) {
        const actualHash = hashPassword(password, options.passwordHashSalt);
        // Use timing-safe comparison to prevent timing attacks
        if (timingSafeCompare(expectedHash, actualHash)) {
          ctx.req.user = { username };
          authenticated = true;
        }
      }
    }

    // Bearer Token Authentication
    if (options.bearer && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Use timing-safe comparison for token validation
      for (const validToken of options.bearer.tokens) {
        if (timingSafeCompare(token, validToken)) {
          ctx.req.user = { token };
          authenticated = true;
          break;
        }
      }
    }

    if (!authenticated) {
      ctx.res.status = 401;
      ctx.res.body = JSON.stringify({ error: 'Authentication failed' });
      return;
    }

    await next();
  };
}

// Simple JWT verification with HMAC-SHA256
function verifyJWT(token: string, secret: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');

  const header = parts[0];
  const payload = parts[1];
  const signature = parts[2];

  // Verify signature using timing-safe comparison
  const expectedSignature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (!timingSafeCompare(signature, expectedSignature)) {
    throw new Error('Invalid signature');
  }

  // Decode payload
  const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());

  // Check expiration
  if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return decodedPayload;
}

/**
 * Hash password using HMAC-SHA256
 * 
 * WARNING: This is NOT recommended for production use. Use bcrypt or argon2 instead.
 * This implementation is provided for compatibility but should be replaced with proper
 * password hashing from packages/auth
 * 
 * @param password - The password to hash
 * @param salt - Optional salt (MUST be from environment variable, never hardcoded)
 */
function hashPassword(password: string, salt?: string): string {
  // Use provided salt or get from environment
  const hashSalt = salt || process.env.PASSWORD_HASH_SALT;
  
  // For test environments ONLY, allow using 'openspeed-salt' for backward compatibility
  // This is ONLY to avoid breaking existing tests and should be replaced
  if (!hashSalt) {
    if (process.env.NODE_ENV === 'test') {
      // WARNING: Using hardcoded salt in tests. This is acceptable ONLY because:
      // 1. Tests are not production code
      // 2. Test hashes are ephemeral and not stored
      // 3. Provides backward compatibility with existing tests
      // In real applications, ALWAYS use environment variables
      console.warn('[AUTH] Using hardcoded test salt. Set PASSWORD_HASH_SALT env var for tests.');
      return createHmac('sha256', 'openspeed-salt').update(password).digest('hex');
    }
    throw new Error('[AUTH] PASSWORD_HASH_SALT environment variable must be set for password hashing');
  }
  
  if ((hashSalt === 'openspeed-salt' || hashSalt.startsWith('dev-')) && process.env.NODE_ENV !== 'test') {
    console.error('[AUTH SECURITY WARNING] Using default/development password salt is dangerous');
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[AUTH] Cannot use default password salt in production');
    }
  }
  
  return createHmac('sha256', hashSalt).update(password).digest('hex');
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * Performs constant-time comparison to avoid leaking information about string length or content
 */
function timingSafeCompare(a: string, b: string): boolean {
  // Convert to buffers for timing-safe comparison
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  
  // If lengths differ, pad the shorter one to match the longer
  // This ensures constant-time behavior regardless of input lengths
  const maxLength = Math.max(bufferA.length, bufferB.length);
  const paddedA = Buffer.alloc(maxLength);
  const paddedB = Buffer.alloc(maxLength);
  
  bufferA.copy(paddedA);
  bufferB.copy(paddedB);
  
  try {
    // This will do constant-time comparison
    const buffersMatch = timingSafeEqual(paddedA, paddedB);
    // Also verify original lengths match (in constant time)
    const lengthsMatch = bufferA.length === bufferB.length;
    return buffersMatch && lengthsMatch;
  } catch {
    return false;
  }
}

export function requireAuth() {
  return async (ctx: Context, next: () => Promise<any>) => {
    if (!ctx.req.user) {
      ctx.res.status = 401;
      ctx.res.body = JSON.stringify({ error: 'Authentication required' });
      return;
    }
    await next();
  };
}
