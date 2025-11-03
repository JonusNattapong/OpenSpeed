/**
 * @deprecated This auth plugin uses weak password hashing (HMAC-SHA256 with hardcoded salt).
 * For production use, please use the secure auth package from `packages/auth` which implements
 * proper bcrypt hashing, key rotation, and comprehensive security features.
 *
 * Migration guide:
 * 1. Install bcryptjs: npm install bcryptjs
 * 2. Replace import: import { hashPassword, verifyPassword, generateAccessToken, ... } from 'packages/auth/src/index.js'
 * 3. Update your auth configuration to use environment variables for secrets
 */
import { createHmac } from 'crypto';
import type { Context } from '../context.js';

// Show deprecation warning once
let deprecationWarningShown = false;

function showDeprecationWarning() {
  if (!deprecationWarningShown) {
    console.error('\n' + '='.repeat(80));
    console.error('⚠️  SECURITY WARNING: DEPRECATED AUTH PLUGIN');
    console.error('='.repeat(80));
    console.error('You are using the deprecated auth plugin with WEAK password hashing!');
    console.error('');
    console.error('🔴 CRITICAL ISSUES:');
    console.error('  - Uses HMAC-SHA256 instead of bcrypt (vulnerable to rainbow tables)');
    console.error('  - Uses hardcoded salt (extremely insecure)');
    console.error('  - No password complexity requirements');
    console.error('  - No rate limiting on authentication');
    console.error('');
    console.error('✅ MIGRATION REQUIRED:');
    console.error('  1. Install bcryptjs: npm install bcryptjs');
    console.error('  2. Use secure auth from packages/auth');
    console.error('  3. Migrate existing password hashes');
    console.error('');
    console.error(
      '📚 Documentation: https://github.com/yourusername/openspeed/docs/auth-migration'
    );
    console.error('='.repeat(80) + '\n');
    deprecationWarningShown = true;

    // In production, throw error instead of warning
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECURITY ERROR: Deprecated auth plugin is NOT allowed in production. ' +
          'Please migrate to the secure auth package from packages/auth.'
      );
    }
  }
}

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
}

export function auth(options: AuthOptions) {
  // Show deprecation warning
  showDeprecationWarning();

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

      // Verify hashed password
      const hashedPassword = hashPassword(password);
      if (options.basic.users[username] === hashedPassword) {
        ctx.req.user = { username };
        authenticated = true;
      }
    }

    // Bearer Token Authentication
    if (options.bearer && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (options.bearer.tokens.includes(token)) {
        ctx.req.user = { token };
        authenticated = true;
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

  // Verify signature
  const expectedSignature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (signature !== expectedSignature) {
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

// Simple password hashing (in production, use bcrypt or argon2)
// ⚠️ SECURITY WARNING: This is NOT secure for production use!
function hashPassword(password: string): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SECURITY ERROR: hashPassword() with hardcoded salt is NOT allowed in production. ' +
        'Use bcrypt or argon2 instead.'
    );
  }

  console.warn('[SECURITY] Using weak password hashing with hardcoded salt - DEVELOPMENT ONLY!');
  return createHmac('sha256', 'openspeed-salt').update(password).digest('hex');
}

export function requireAuth() {
  // Show deprecation warning
  showDeprecationWarning();

  return async (ctx: Context, next: () => Promise<any>) => {
    if (!ctx.req.user) {
      ctx.res.status = 401;
      ctx.res.body = JSON.stringify({ error: 'Authentication required' });
      return;
    }
    await next();
  };
}
