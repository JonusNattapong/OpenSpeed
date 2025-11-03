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
        cookie: 'session=abc123; user=ElonDuck',
      },
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
      headers: {},
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {
      ctx.cookies?.set('session', 'xyz789', { httpOnly: true });
    });

    expect(ctx.res.headers!['Set-Cookie']).toBeDefined();
    expect(ctx.res.headers!['Set-Cookie']).toContain('session=xyz789');
    expect(ctx.res.headers!['Set-Cookie']).toContain('HttpOnly');
  });

  it('should handle setCookie helper', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {},
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {
      setCookie(ctx, 'token', 'secret123', { secure: true, maxAge: 3600 });
    });

    expect(ctx.res.headers!['Set-Cookie']).toBeDefined();
    expect(ctx.res.headers!['Set-Cookie']).toContain('token=secret123');
    expect(ctx.res.headers!['Set-Cookie']).toContain('Secure');
  });

  it('should handle getCookie helper', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {
        cookie: 'auth=token123',
      },
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
        cookie: 'session=abc123',
      },
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {
      deleteCookie(ctx, 'session');
    });

    // After delete, the cookie value is set to empty string with Max-Age=0
    expect(ctx.cookies?.get('session')).toBe('');
    expect(ctx.res.headers!['Set-Cookie']).toBeDefined();
    expect(ctx.res.headers!['Set-Cookie']).toContain('Max-Age=0');
  });

  it('should handle URL-encoded cookie values', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {
        cookie: 'name=John%20Duck',
      },
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {});

    expect(ctx.cookies?.get('name')).toBe('John Duck');
  });

  it('should properly encode special characters in cookie values', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {},
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {
      // Test encoding of special characters
      ctx.cookies?.set('data', 'value with spaces & special=chars');
    });

    const setCookieHeader = ctx.res.headers!['Set-Cookie'] as string;
    expect(setCookieHeader).toBeDefined();
    // Should be URL encoded
    expect(setCookieHeader).toContain('data=value%20with%20spaces%20%26%20special%3Dchars');
  });

  it('should sanitize cookie paths to prevent injection', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {},
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {
      // Test path sanitization - semicolons should be removed
      ctx.cookies?.set('test', 'value', { path: '/path;malicious' });
    });

    const setCookieHeader = ctx.res.headers!['Set-Cookie'] as string;
    expect(setCookieHeader).toBeDefined();
    // Semicolon should be removed from path
    expect(setCookieHeader).toContain('Path=/pathmalicious');
  });

  it('should reject cookies with dangerous names', async () => {
    const middleware = cookie();

    const req: any = {
      method: 'GET',
      url: '/test',
      headers: {},
    };
    const ctx = new Context(req, {});

    // Spy on console.warn to check if warning is logged
    const warnSpy = vi ? vi.spyOn(console, 'warn').mockImplementation(() => {}) : null;

    await middleware(ctx, async () => {
      // Try to set cookie with semicolon in name (dangerous)
      ctx.cookies?.set('bad;name', 'value');
    });

    const setCookieHeader = ctx.res.headers!['Set-Cookie'] as string;
    
    // Cookie with invalid name should be skipped or sanitized
    if (warnSpy) {
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    }
  });
});
