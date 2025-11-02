import type { Context } from '../context.js';
import { CookieJar, type CookieOptions } from '../context.js';

export function cookie() {
  return (ctx: Context, next: () => Promise<any>) => {
    // Initialize cookie jar
    ctx.cookies = new CookieJar();

    // Parse incoming cookies
    const cookieHeader = ctx.req.headers.cookie;
    if (cookieHeader && typeof cookieHeader === 'string') {
      parseCookies(cookieHeader, ctx.cookies);
    }

    return next().then(() => {
      // Set outgoing cookies
      if (ctx.cookies) {
        const cookieString = ctx.cookies.toHeaderString();
        if (cookieString) {
          ctx.res.headers = {
            ...ctx.res.headers,
            'Set-Cookie': cookieString
          };
        }
      }
    });
  };
}

// Parse cookie header string into CookieJar
function parseCookies(cookieHeader: string, jar: CookieJar) {
  const cookies = cookieHeader.split(';').map(c => c.trim());

  for (const cookie of cookies) {
    const [nameValue, ..._attributes] = cookie.split(';');
    const [name, value] = nameValue.split('=').map(s => s.trim());

    if (name && value !== undefined) {
      // For simplicity, we're not parsing all attributes here
      // In production, you might want to parse expires, max-age, etc.
      jar.set(name, decodeURIComponent(value));
    }
  }
}

// Helper functions for common cookie operations
export function setCookie(ctx: Context, name: string, value: string, options: CookieOptions = {}) {
  if (!ctx.cookies) {
    ctx.cookies = new CookieJar();
  }
  ctx.cookies.set(name, value, options);
}

export function getCookie(ctx: Context, name: string): string | undefined {
  return ctx.cookies?.get(name);
}

export function deleteCookie(ctx: Context, name: string, options: CookieOptions = {}) {
  if (ctx.cookies) {
    ctx.cookies.delete(name);
    // Set the cookie with an expired date to clear it from the client
    ctx.cookies.set(name, '', { ...options, maxAge: 0, expires: new Date(0) });
  }
}

export function clearCookies(ctx: Context) {
  ctx.cookies?.clear();
}