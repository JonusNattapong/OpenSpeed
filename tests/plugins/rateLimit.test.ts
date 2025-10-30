import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit } from '../../src/openspeed/plugins/rateLimit.js';
import Context from '../../src/openspeed/context.js';

describe('rateLimit plugin', () => {
  it('should allow requests under the limit', async () => {
    const middleware = rateLimit({
      windowMs: 1000,
      max: 3
    });

    const req: any = {
      method: 'GET',
      url: '/api/test',
      headers: {
        'x-forwarded-for': '127.0.0.1'
      }
    };
    const ctx = new Context(req, {});

    let callCount = 0;
    for (let i = 0; i < 3; i++) {
      await middleware(ctx, async () => {
        callCount++;
      });
    }

    expect(callCount).toBe(3);
  });

  it('should block requests over the limit', async () => {
    const middleware = rateLimit({
      windowMs: 1000,
      max: 2
    });

    const req: any = {
      method: 'GET',
      url: '/api/test',
      headers: {
        'x-forwarded-for': '127.0.0.2'
      }
    };

    let callCount = 0;
    
    // First two requests should succeed
    for (let i = 0; i < 2; i++) {
      const ctx = new Context(req, {});
      await middleware(ctx, async () => {
        callCount++;
      });
    }

    // Third request should be blocked
    const ctx3 = new Context(req, {});
    await middleware(ctx3, async () => {
      callCount++;
    });

    expect(callCount).toBe(2);
    expect(ctx3.res.status).toBe(429);
  });

  it('should use custom keyGenerator', async () => {
    const middleware = rateLimit({
      windowMs: 1000,
      max: 1,
      keyGenerator: (ctx) => ctx.req.headers['user-id'] as string || 'anonymous'
    });

    const req1: any = {
      method: 'GET',
      url: '/api/test',
      headers: {
        'user-id': 'user-123'
      }
    };
    const req2: any = {
      method: 'GET',
      url: '/api/test',
      headers: {
        'user-id': 'user-456'
      }
    };

    const ctx1 = new Context(req1, {});
    const ctx2 = new Context(req2, {});

    let callCount = 0;

    // Both users should be able to make one request
    await middleware(ctx1, async () => {
      callCount++;
    });
    await middleware(ctx2, async () => {
      callCount++;
    });

    expect(callCount).toBe(2);
  });

  it('should set rate limit headers', async () => {
    const middleware = rateLimit({
      windowMs: 1000,
      max: 1
    });

    const req: any = {
      method: 'GET',
      url: '/api/test',
      headers: {
        'x-forwarded-for': '127.0.0.3'
      }
    };

    const ctx1 = new Context(req, {});
    await middleware(ctx1, async () => {});

    const ctx2 = new Context(req, {});
    await middleware(ctx2, async () => {});

    expect(ctx2.res.headers).toHaveProperty('X-RateLimit-Limit');
    expect(ctx2.res.headers).toHaveProperty('X-RateLimit-Remaining');
    expect(ctx2.res.headers).toHaveProperty('Retry-After');
  });
});
