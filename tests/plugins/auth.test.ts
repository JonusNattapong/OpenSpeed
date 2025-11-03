import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { auth, requireAuth } from '../../src/openspeed/plugins/auth.js';
import Context from '../../src/openspeed/context.js';

describe('auth plugin', () => {
  // Set up environment variable for tests
  const originalPasswordSalt = process.env.PASSWORD_SALT;
  
  beforeAll(() => {
    // Use a test salt that meets minimum requirements (32+ chars)
    process.env.PASSWORD_SALT = 'test-salt-for-unit-tests-must-be-32-chars-minimum-length';
  });
  
  afterAll(() => {
    // Restore original environment
    if (originalPasswordSalt) {
      process.env.PASSWORD_SALT = originalPasswordSalt;
    } else {
      delete process.env.PASSWORD_SALT;
    }
  });

  it('should authenticate with Basic auth', async () => {
    // Hash the password with the test salt
    const hashedPassword = require('crypto')
      .createHmac('sha256', process.env.PASSWORD_SALT!)
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
    // Hash the correct password with test salt
    const hashedPassword = require('crypto')
      .createHmac('sha256', process.env.PASSWORD_SALT!)
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
