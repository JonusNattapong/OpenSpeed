import type { Context } from '../context.js';

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
  // Security headers
  contentSecurityPolicy?: string;
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  xContentTypeOptions?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: string;
}

export function cors(options: CorsOptions = {}) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 86400,
    contentSecurityPolicy,
    xFrameOptions,
    xContentTypeOptions = true,
    referrerPolicy,
    permissionsPolicy,
  } = options;

  // SECURITY FIX: Validate credentials setting - cannot use '*' with credentials
  if (credentials && origin === '*') {
    throw new Error(
      'CORS security violation: Cannot use wildcard origin (*) when credentials are enabled. ' +
      'Specify explicit origins or disable credentials.'
    );
  }

  return async (ctx: Context, next: () => Promise<any>) => {
    const reqOrigin = ctx.req.headers.origin as string;
    let allowOrigin = '*';

    if (origin === '*') {
      allowOrigin = '*';
    } else if (typeof origin === 'string') {
      allowOrigin = origin;
    } else if (Array.isArray(origin)) {
      if (origin.includes(reqOrigin)) allowOrigin = reqOrigin;
    } else if (typeof origin === 'function') {
      if (origin(reqOrigin)) allowOrigin = reqOrigin;
    }

    ctx.res.headers = {
      ...ctx.res.headers,
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': methods.join(', '),
      'Access-Control-Allow-Headers': headers.join(', '),
      'Access-Control-Max-Age': maxAge.toString(),
      // Security headers
      ...(contentSecurityPolicy && { 'Content-Security-Policy': contentSecurityPolicy }),
      ...(xFrameOptions && { 'X-Frame-Options': xFrameOptions }),
      ...(xContentTypeOptions && { 'X-Content-Type-Options': 'nosniff' }),
      ...(referrerPolicy && { 'Referrer-Policy': referrerPolicy }),
      ...(permissionsPolicy && { 'Permissions-Policy': permissionsPolicy }),
    };

    if (credentials) {
      ctx.res.headers['Access-Control-Allow-Credentials'] = 'true';
    }

    if (ctx.req.method === 'OPTIONS') {
      ctx.res.status = 200;
      return;
    }

    await next();
  };
}
