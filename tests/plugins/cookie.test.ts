import { describe, it, expect } from 'vitest';
import { cookie, setCookie, getCookie, deleteCookie } from '../../src/openspeed/plugins/cookie.js';
import Context from '../../src/openspeed/context.js';

describe('cookie plugin', () => {
  it('should parse incoming cookies', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {
        cookie: 'session=abc123; user=ElonDuck'
      }
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {});

    expect(ctx.cookies?.get('session')).toBe('abc123');
    expect(ctx.cookies?.get('user')).toBe('ElonDuck');
  });

  it('should set outgoing cookies', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {}
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {
      ctx.cookies?.set('session', 'xyz789', { httpOnly: true });
    });

    expect(ctx.res.headers['Set-Cookie']).toBeDefined();
    expect(ctx.res.headers['Set-Cookie']).toContain('session=xyz789');
    expect(ctx.res.headers['Set-Cookie']).toContain('HttpOnly');
  });

  it('should handle setCookie helper', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {}
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {
      setCookie(ctx, 'token', 'secret123', { secure: true, maxAge: 3600 });
    });

    expect(ctx.res.headers['Set-Cookie']).toBeDefined();
    expect(ctx.res.headers['Set-Cookie']).toContain('token=secret123');
    expect(ctx.res.headers['Set-Cookie']).toContain('Secure');
  });

  it('should handle getCookie helper', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {
        cookie: 'auth=token123'
      }
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {
      const auth = getCookie(ctx, 'auth');
      expect(auth).toBe('token123');
    });
  });

  it('should handle deleteCookie helper', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {
        cookie: 'session=abc123'
      }
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {
      deleteCookie(ctx, 'session');
    });

    // After delete, the cookie value is set to empty string with Max-Age=0
    expect(ctx.cookies?.get('session')).toBe('');
    expect(ctx.res.headers['Set-Cookie']).toBeDefined();
    expect(ctx.res.headers['Set-Cookie']).toContain('Max-Age=0');
  });

  it('should handle URL-encoded cookie values', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {
        cookie: 'name=John%20Duck'
      }
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {});

    expect(ctx.cookies?.get('name')).toBe('John Duck');
  });
});
