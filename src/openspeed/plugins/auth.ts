import { createHmac } from 'crypto';
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
}

export function auth(options: AuthOptions) {
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
function hashPassword(password: string): string {
  return createHmac('sha256', 'openspeed-salt').update(password).digest('hex');
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
