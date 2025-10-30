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
    users: Record<string, string>; // username: password
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
        // Simple JWT decode (in production, use a proper JWT library)
        const payload = decodeJWT(token, options.jwt.secret);
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

      if (options.basic.users[username] === password) {
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

// Simple JWT decode (for demo purposes - use proper JWT library in production)
function decodeJWT(token: string, secret: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');

  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  // In production, verify signature here
  return payload;
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