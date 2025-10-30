import type { Context } from '../context.js';

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function cors(options: CorsOptions = {}) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 86400,
  } = options;

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