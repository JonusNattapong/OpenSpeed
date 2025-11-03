import type { Context } from '../context.js';

export interface SecurityOptions {
  // Helmet-like headers
  contentSecurityPolicy?: string | boolean;
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  noSniff?: boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  xssProtection?: boolean;

  // Input validation
  sanitizeInput?: boolean;
  maxBodySize?: number;

  // CSRF protection
  csrf?: {
    secret?: string;
    cookieName?: string;
    headerName?: string;
  };

  // Security logging
  logSecurityEvents?: boolean;

  // Custom security checks
  customChecks?: Array<(ctx: Context) => Promise<boolean | { error: string; status?: number }>>;
}

export interface SecurityEvent {
  type: 'suspicious_request' | 'csrf_violation' | 'xss_attempt' | 'large_payload' | 'invalid_input';
  timestamp: number;
  ip: string;
  userAgent?: string;
  url: string;
  details: any;
}

/**
 * Comprehensive security middleware plugin
 * Provides multiple layers of security protection
 */
export function security(options: SecurityOptions = {}) {
  const {
    contentSecurityPolicy = "default-src 'self'",
    hsts = { maxAge: 31536000, includeSubDomains: true },
    noSniff = true,
    frameOptions = 'DENY',
    xssProtection = true,
    sanitizeInput = true,
    maxBodySize = 1024 * 1024, // 1MB
    csrf,
    logSecurityEvents = true,
    customChecks = [],
  } = options;

  // Security event logger
  const logSecurityEvent = (event: SecurityEvent) => {
    if (logSecurityEvents) {
      console.warn('[SECURITY]', JSON.stringify(event, null, 2));
    }
  };

  return async (ctx: Context, next: () => Promise<any>) => {
    const clientIP = getClientIP(ctx);
    const userAgent = ctx.req.headers['user-agent'] as string;

    try {
      // 1. Check request size
      if (maxBodySize > 0) {
        const contentLength = parseInt((ctx.req.headers['content-length'] as string) || '0');
        if (contentLength > maxBodySize) {
          logSecurityEvent({
            type: 'large_payload',
            timestamp: Date.now(),
            ip: clientIP,
            userAgent,
            url: ctx.req.url,
            details: { contentLength, maxBodySize },
          });
          ctx.res.status = 413;
          ctx.res.body = JSON.stringify({ error: 'Payload too large' });
          ctx.res.headers = { ...ctx.res.headers, 'Content-Type': 'application/json' };
          return;
        }
      }

      // 2. Input sanitization
      if (sanitizeInput) {
        const sanitized = sanitizeRequestInput(ctx);
        if (sanitized.hasSuspiciousContent) {
          logSecurityEvent({
            type: 'suspicious_request',
            timestamp: Date.now(),
            ip: clientIP,
            userAgent,
            url: ctx.req.url,
            details: sanitized.details,
          });
        }
      }

      // 3. CSRF protection
      if (csrf) {
        const csrfResult = await validateCSRF(ctx, csrf);
        if (!csrfResult.valid) {
          logSecurityEvent({
            type: 'csrf_violation',
            timestamp: Date.now(),
            ip: clientIP,
            userAgent,
            url: ctx.req.url,
            details: csrfResult.details,
          });
          ctx.res.status = 403;
          ctx.res.body = JSON.stringify({ error: 'CSRF token validation failed' });
          ctx.res.headers = { ...ctx.res.headers, 'Content-Type': 'application/json' };
          return;
        }
      }

      // 4. Custom security checks
      for (const check of customChecks) {
        const result = await check(ctx);
        if (result !== true) {
          const error = typeof result === 'object' ? result : { error: 'Security check failed' };
          logSecurityEvent({
            type: 'suspicious_request',
            timestamp: Date.now(),
            ip: clientIP,
            userAgent,
            url: ctx.req.url,
            details: error,
          });
          ctx.res.status = error.status || 403;
          ctx.res.body = JSON.stringify({ error: error.error });
          ctx.res.headers = { ...ctx.res.headers, 'Content-Type': 'application/json' };
          return;
        }
      }

      // 5. Set security headers
      const securityHeaders: Record<string, string> = {
        ...ctx.res.headers,
        // Referrer Policy
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // Permissions Policy
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      };

      // Content Security Policy
      if (typeof contentSecurityPolicy === 'string') {
        securityHeaders['Content-Security-Policy'] = contentSecurityPolicy;
      }

      // HSTS
      if (hsts) {
        securityHeaders['Strict-Transport-Security'] = `max-age=${hsts.maxAge || 31536000}${
          hsts.includeSubDomains ? '; includeSubDomains' : ''
        }${hsts.preload ? '; preload' : ''}`;
      }

      // Prevent MIME type sniffing
      if (noSniff) {
        securityHeaders['X-Content-Type-Options'] = 'nosniff';
      }

      // Clickjacking protection
      if (frameOptions) {
        securityHeaders['X-Frame-Options'] = frameOptions;
      }

      // XSS protection
      if (xssProtection) {
        securityHeaders['X-XSS-Protection'] = '1; mode=block';
      }

      ctx.res.headers = securityHeaders;

      await next();
    } catch (error) {
      // Log unexpected security-related errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logSecurityEvent({
        type: 'suspicious_request',
        timestamp: Date.now(),
        ip: clientIP,
        userAgent,
        url: ctx.req.url,
        details: { error: errorMessage },
      });
      throw error;
    }
  };
}

/**
 * Get client IP address
 */
function getClientIP(ctx: Context): string {
  const headers = ctx.req.headers as any;
  return (
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    headers['x-real-ip'] ||
    headers['cf-connecting-ip'] ||
    'unknown'
  );
}

/**
 * Sanitize request input and detect suspicious patterns
 */
function sanitizeRequestInput(ctx: Context): { hasSuspiciousContent: boolean; details: any } {
  const suspicious = {
    hasSuspiciousContent: false,
    details: {} as any,
  };

  // Check URL for suspicious patterns
  const url = ctx.req.url;
  const suspiciousUrlPatterns = [
    /\.\./, // Directory traversal
    /<script/i, // XSS attempts
    /javascript:/i, // JavaScript URLs
    /data:/i, // Data URLs that might be malicious
    /vbscript:/i, // VBScript
    /onload=/i, // Event handlers
    /onerror=/i,
    /onclick=/i,
  ];

  for (const pattern of suspiciousUrlPatterns) {
    if (pattern.test(url)) {
      suspicious.hasSuspiciousContent = true;
      suspicious.details.url = { pattern: pattern.source, match: url.match(pattern)?.[0] };
      break;
    }
  }

  // Check headers for suspicious content
  const headersToCheck = ['user-agent', 'referer', 'accept', 'accept-language'];
  for (const headerName of headersToCheck) {
    const headerValue = ctx.req.headers[headerName] as string;
    if (headerValue) {
      for (const pattern of suspiciousUrlPatterns) {
        if (pattern.test(headerValue)) {
          suspicious.hasSuspiciousContent = true;
          suspicious.details.headers = {
            ...suspicious.details.headers,
            [headerName]: { pattern: pattern.source, match: headerValue.match(pattern)?.[0] },
          };
        }
      }
    }
  }

  return suspicious;
}

/**
 * Validate CSRF token
 */
async function validateCSRF(
  ctx: Context,
  options: NonNullable<SecurityOptions['csrf']>
): Promise<{ valid: boolean; details?: any }> {
  // SECURITY FIX: Enforce environment variable for CSRF secret
  const secret = options.secret || process.env.CSRF_SECRET;
  
  if (!secret) {
    throw new Error(
      'SECURITY ERROR: CSRF secret is required. Set CSRF_SECRET environment variable or pass secret in options. ' +
      'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  if (secret.length < 32) {
    throw new Error(
      'SECURITY ERROR: CSRF secret must be at least 32 characters long for adequate security.'
    );
  }
  
  const {
    cookieName = 'csrf-token',
    headerName = 'x-csrf-token',
  } = options;

  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(ctx.req.method)) {
    return { valid: true };
  }

  // Get token from header
  const headerToken = ctx.req.headers[headerName] as string;
  if (!headerToken) {
    return { valid: false, details: { reason: 'Missing CSRF token in header' } };
  }

  // Get token from cookie
  const cookieToken = ctx.getCookie(cookieName);
  if (!cookieToken) {
    return { valid: false, details: { reason: 'Missing CSRF token in cookie' } };
  }

  // Validate tokens match
  if (headerToken !== cookieToken) {
    return { valid: false, details: { reason: 'CSRF tokens do not match' } };
  }

  // Additional validation could include timing checks, etc.
  return { valid: true };
}

/**
 * Generate CSRF token (utility function)
 * SECURITY: Requires a secret key for token generation
 */
export function generateCSRFToken(secret?: string): string {
  // SECURITY FIX: Enforce secret requirement
  const csrfSecret = secret || process.env.CSRF_SECRET;
  
  if (!csrfSecret) {
    throw new Error(
      'SECURITY ERROR: CSRF secret is required. Set CSRF_SECRET environment variable or pass secret parameter. ' +
      'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  if (csrfSecret.length < 32) {
    throw new Error(
      'SECURITY ERROR: CSRF secret must be at least 32 characters long for adequate security.'
    );
  }
  
  // Generate cryptographically secure random token
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Set CSRF cookie (utility function)
 */
export function setCSRFCookie(ctx: Context, token: string, cookieName: string = 'csrf-token') {
  ctx.setCookie(cookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600, // 1 hour
  });
}

/**
 * Security middleware presets
 */
export const securityPresets = {
  // Basic security for development
  development: {
    contentSecurityPolicy: "default-src 'self' 'unsafe-inline'", // Removed 'unsafe-eval' for security
    hsts: false,
    logSecurityEvents: true,
  },

  // Strict security for production
  production: {
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    csrf: { secret: process.env.CSRF_SECRET },
    logSecurityEvents: true,
  },

  // API security
  api: {
    contentSecurityPolicy: false, // APIs don't need CSP
    hsts: { maxAge: 31536000, includeSubDomains: true },
    csrf: { secret: process.env.CSRF_SECRET },
    sanitizeInput: true,
    maxBodySize: 1024 * 1024, // 1MB
  },
};

/**
 * Example usage:
 *
 * import { security, securityPresets } from 'openspeed/plugins/security';
 *
 * // Use preset
 * app.use(security(securityPresets.production));
 *
 * // Custom configuration
 * app.use(security({
 *   contentSecurityPolicy: "default-src 'self'",
 *   csrf: { secret: process.env.CSRF_SECRET },
 *   customChecks: [
 *     async (ctx) => {
 *       // Custom security check
 *       if (ctx.req.headers['x-api-key'] !== process.env.API_KEY) {
 *         return { error: 'Invalid API key', status: 401 };
 *       }
 *       return true;
 *     }
 *   ]
 * }));
 */
