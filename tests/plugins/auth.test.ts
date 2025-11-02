import { describe, it, expect } from 'vitest';
import { auth, requireAuth } from '../../src/openspeed/plugins/auth.js';
import Context from '../../src/openspeed/context.js';

describe('auth plugin', () => {
  it('should authenticate with Basic auth', async () => {
    // Hash the password as the auth plugin now requires hashed passwords
    const hashedPassword = require('crypto')
      .createHmac('sha256', 'openspeed-salt')
      .update('password123')
      .digest('hex');

    const middleware = auth({
      basic: {
        users: {
          admin: hashedPassword,
        },
      },
    });

    const req: any = {
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Basic ' + Buffer.from('admin:password123').toString('base64'),
      },
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx.req.user).toEqual({ username: 'admin' });
  });

  it('should reject invalid Basic auth', async () => {
    // Hash the correct password
    const hashedPassword = require('crypto')
      .createHmac('sha256', 'openspeed-salt')
      .update('password123')
      .digest('hex');

    const middleware = auth({
      basic: {
        users: {
          admin: hashedPassword,
        },
      },
    });

    const req: any = {
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Basic ' + Buffer.from('admin:wrongpassword').toString('base64'),
      },
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(ctx.res.status).toBe(401);
  });

  it('should authenticate with Bearer token', async () => {
    const middleware = auth({
      bearer: {
        tokens: ['secret-token-123'],
      },
    });

    const req: any = {
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Bearer secret-token-123',
      },
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx.req.user).toEqual({ token: 'secret-token-123' });
  });

  it('should require authentication header', async () => {
    const middleware = auth({
      bearer: {
        tokens: ['secret-token-123'],
      },
    });

    const req: any = {
      method: 'GET',
      url: '/protected',
      headers: {},
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(ctx.res.status).toBe(401);
  });

  it('requireAuth should block unauthenticated requests', async () => {
    const middleware = requireAuth();

    const req: any = {
      method: 'GET',
      url: '/protected',
      headers: {},
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(ctx.res.status).toBe(401);
  });

  it('requireAuth should allow authenticated requests', async () => {
    const middleware = requireAuth();

    const req: any = {
      method: 'GET',
      url: '/protected',
      headers: {},
      user: { username: 'admin' },
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});
