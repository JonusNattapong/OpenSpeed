import type { Context } from '../context.js';
import { CookieJar, type CookieOptions } from '../context.js';
import { randomBytes } from 'crypto';

/**
 * Secure cookie defaults for production
 */
export const SECURE_COOKIE_DEFAULTS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

export interface CookiePluginOptions {
  /**
   * Use secure defaults (httpOnly, secure, sameSite)
   * @default true
   */
  secureDefaults?: boolean;
  /**
   * Override default cookie options
   */
  defaultOptions?: CookieOptions;
  /**
   * Warn when setting insecure cookies
   * @default true
   */
  warnInsecure?: boolean;
}

export function cookie(options: CookiePluginOptions = {}) {
  const { secureDefaults = true, defaultOptions = {}, warnInsecure = true } = options;

  const defaults = secureDefaults
    ? { ...SECURE_COOKIE_DEFAULTS, ...defaultOptions }
    : defaultOptions;

  return (ctx: Context, next: () => Promise<any>) => {
    // Initialize cookie jar with secure defaults
    ctx.cookies = new CookieJar();

    // Store default options for later use
    (ctx.cookies as any)._defaults = defaults;
    (ctx.cookies as any)._warnInsecure = warnInsecure;

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
            'Set-Cookie': cookieString,
          };
        }
      }
    });
  };
}

// Safe URL decoding with error handling
function safeDecodeURIComponent(encoded: string): string {
  try {
    // Check for potentially malicious encoding patterns
    if (encoded.includes('%00') || encoded.includes('%0D') || encoded.includes('%0A')) {
      throw new Error('Invalid cookie value: contains null bytes or line breaks');
    }
    return decodeURIComponent(encoded);
  } catch (error) {
    // If decoding fails, return the original value (could be malformed)
    console.warn('[COOKIE SECURITY] Failed to decode cookie value:', encoded, error);
    return encoded;
  }
}

// Parse cookie header string into CookieJar
function parseCookies(cookieHeader: string, jar: CookieJar) {
  const cookies = cookieHeader.split(';').map((c) => c.trim());

  for (const cookie of cookies) {
    const [nameValue] = cookie.split(';');
    const [name, value] = nameValue.split('=').map((s) => s.trim());

    if (name && value !== undefined) {
      // For simplicity, we're not parsing all attributes here
      // In production, you might want to parse expires, max-age, etc.
      jar.set(name, safeDecodeURIComponent(value));
    }
  }
}

// Helper functions for common cookie operations
export function setCookie(ctx: Context, name: string, value: string, options: CookieOptions = {}) {
  if (!ctx.cookies) {
    ctx.cookies = new CookieJar();
  }

  // Apply secure defaults
  const defaults = (ctx.cookies as any)._defaults || {};
  const warnInsecure = (ctx.cookies as any)._warnInsecure !== false;
  const finalOptions = { ...defaults, ...options };

  // Warn about insecure cookies in production
  if (warnInsecure && process.env.NODE_ENV === 'production') {
    if (!finalOptions.httpOnly) {
      console.warn(
        `[COOKIE SECURITY] Cookie '${name}' is not httpOnly - vulnerable to XSS attacks`
      );
    }
    if (!finalOptions.secure) {
      console.warn(`[COOKIE SECURITY] Cookie '${name}' is not secure - vulnerable to MITM attacks`);
    }
    if (finalOptions.sameSite !== 'strict' && finalOptions.sameSite !== 'lax') {
      console.warn(
        `[COOKIE SECURITY] Cookie '${name}' is not using sameSite - vulnerable to CSRF attacks`
      );
    }
  }

  ctx.cookies.set(name, value, finalOptions);
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

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Regenerate session ID (prevent session fixation attacks)
 * Call this after successful login or privilege elevation
 */
export function regenerateSession(ctx: Context, sessionCookieName: string = 'sessionId'): string {
  if (!ctx.cookies) {
    ctx.cookies = new CookieJar();
  }

  // Get old session data if needed (extend this to copy session data)
  const oldSessionId = ctx.cookies.get(sessionCookieName);

  if (oldSessionId) {
    console.log(`[SESSION] Regenerating session: ${oldSessionId.substring(0, 8)}...`);
  }

  // Delete old session cookie
  deleteCookie(ctx, sessionCookieName);

  // Generate new session ID
  const newSessionId = generateSessionId();

  // Set new session cookie with secure defaults
  // ✅ SECURITY: Enforces httpOnly, secure (in prod), and sameSite flags
  setCookie(ctx, sessionCookieName, newSessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400, // 24 hours in seconds
  });

  console.log(`[SESSION] New session created: ${newSessionId.substring(0, 8)}...`);

  return newSessionId;
}

/**
 * Validate session cookie exists and is properly formatted
 */
export function validateSession(ctx: Context, sessionCookieName: string = 'sessionId'): boolean {
  const sessionId = getCookie(ctx, sessionCookieName);

  if (!sessionId) {
    return false;
  }

  // Basic validation: check if it's a hex string of correct length
  if (!/^[a-f0-9]{64}$/.test(sessionId)) {
    console.warn('[SESSION SECURITY] Invalid session ID format detected');
    return false;
  }

  return true;
}

/**
 * Set a secure cookie with all recommended security options
 */
export function setSecureCookie(
  ctx: Context,
  name: string,
  value: string,
  options: Omit<CookieOptions, 'httpOnly' | 'secure' | 'sameSite'> = {}
) {
  setCookie(ctx, name, value, {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}
