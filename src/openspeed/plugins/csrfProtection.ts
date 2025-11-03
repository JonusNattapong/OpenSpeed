/**
 * Enhanced CSRF Protection Plugin
 * 
 * Provides comprehensive Cross-Site Request Forgery protection
 */

import { randomBytes, createHmac } from 'crypto';
import type { Context } from '../context.js';

export interface CSRFOptions {
  secret?: string;
  cookieName?: string;
  headerName?: string;
  tokenName?: string;
  enforceForMethods?: string[];
  cookieOptions?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
  };
  ignorePaths?: string[];
  validateOrigin?: boolean;
  trustedOrigins?: string[];
}

export class CSRFProtection {
  private options: Required<CSRFOptions> & { cookieOptions: Required<CSRFOptions['cookieOptions']> };

  constructor(options: CSRFOptions = {}) {
    this.options = {
      secret: options.secret || process.env.CSRF_SECRET || this.generateSecret(),
      cookieName: options.cookieName || '_csrf',
      headerName: options.headerName || 'x-csrf-token',
      tokenName: options.tokenName || 'csrf_token',
      enforceForMethods: options.enforceForMethods || ['POST', 'PUT', 'DELETE', 'PATCH'],
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: 3600000, // 1 hour
        ...options.cookieOptions,
      },
      ignorePaths: options.ignorePaths || [],
      validateOrigin: options.validateOrigin ?? true,
      trustedOrigins: options.trustedOrigins || [],
    };
  }

  /**
   * Generate CSRF secret
   */
  private generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate CSRF token
   */
  generateToken(): string {
    const salt = randomBytes(16).toString('hex');
    const token = createHmac('sha256', this.options.secret)
      .update(salt)
      .digest('hex');
    
    return `${salt}.${token}`;
  }

  /**
   * Verify CSRF token
   */
  verifyToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const [salt, expectedToken] = token.split('.');
    
    if (!salt || !expectedToken) {
      return false;
    }

    const actualToken = createHmac('sha256', this.options.secret)
      .update(salt)
      .digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    return this.constantTimeCompare(actualToken, expectedToken);
  }

  /**
   * Constant-time string comparison
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validate origin header
   */
  private validateOrigin(ctx: Context): boolean {
    const origin = ctx.req.headers.origin as string;
    const referer = ctx.req.headers.referer as string;

    // If no origin checking required
    if (!this.options.validateOrigin) {
      return true;
    }

    // Check if origin is trusted
    if (this.options.trustedOrigins.length > 0) {
      const isOriginTrusted = this.options.trustedOrigins.some(trusted => {
        return origin?.startsWith(trusted) || referer?.startsWith(trusted);
      });

      if (!isOriginTrusted) {
        console.warn(`[CSRF] Untrusted origin: ${origin || referer}`);
        return false;
      }
    }

    // Verify origin matches host
    if (origin) {
      const host = ctx.req.headers.host as string;
      const originHost = new URL(origin).host;

      if (originHost !== host) {
        console.warn(`[CSRF] Origin mismatch: ${originHost} !== ${host}`);
        return false;
      }
    }

    return true;
  }

  /**
   * CSRF middleware
   */
  middleware() {
    return async (ctx: Context, next: () => Promise<any>) => {
      const method = ctx.req.method.toUpperCase();
      const path = ctx.req.url;

      // Skip ignored paths
      if (this.options.ignorePaths.some(p => path.startsWith(p))) {
        return next();
      }

      // For safe methods (GET, HEAD, OPTIONS), generate and set token
      if (!this.options.enforceForMethods.includes(method)) {
        const token = this.generateToken();
        
        // Set token in cookie
        if (ctx.cookies) {
          ctx.cookies.set(this.options.cookieName, token, this.options.cookieOptions);
        }
        
        // Make token available to templates
        ctx.req.csrfToken = token;
        
        return next();
      }

      // For unsafe methods, validate token
      const tokenFromHeader = ctx.req.headers[this.options.headerName] as string;
      const tokenFromBody = (ctx.req.body as any)?.[this.options.tokenName];
      const tokenFromCookie = ctx.cookies?.get(this.options.cookieName);

      const token = tokenFromHeader || tokenFromBody;

      // Validate origin first
      if (!this.validateOrigin(ctx)) {
        ctx.res.status = 403;
        ctx.res.body = JSON.stringify({
          error: 'CSRF Protection: Invalid origin',
          code: 'CSRF_ORIGIN_MISMATCH',
        });
        return;
      }

      // Validate CSRF token
      if (!token || !tokenFromCookie || token !== tokenFromCookie || !this.verifyToken(token)) {
        console.error('[CSRF] Token validation failed', {
          method,
          path,
          hasHeader: !!tokenFromHeader,
          hasBody: !!tokenFromBody,
          hasCookie: !!tokenFromCookie,
          clientIP: this.getClientIP(ctx),
        });

        ctx.res.status = 403;
        ctx.res.body = JSON.stringify({
          error: 'CSRF Protection: Invalid or missing token',
          code: 'CSRF_TOKEN_INVALID',
          hint: `Include CSRF token in header '${this.options.headerName}' or body field '${this.options.tokenName}'`,
        });
        return;
      }

      // Token is valid, proceed
      await next();
    };
  }

  /**
   * Get client IP
   */
  private getClientIP(ctx: Context): string {
    return (
      ctx.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      ctx.req.headers['x-real-ip']?.toString() ||
      ctx.req.headers['cf-connecting-ip']?.toString() ||
      'unknown'
    );
  }
}

/**
 * Create CSRF protection middleware
 */
export function csrf(options?: CSRFOptions) {
  const protection = new CSRFProtection(options);
  return protection.middleware();
}

/**
 * CSRF token helper for templates
 */
export function csrfToken(ctx: Context): string {
  return (ctx.req as any).csrfToken || '';
}

/**
 * CSRF hidden input helper for forms
 */
export function csrfInput(ctx: Context, name = 'csrf_token'): string {
  const token = csrfToken(ctx);
  return `<input type="hidden" name="${name}" value="${token}" />`;
}
