import type { Context } from '../context.js';

export interface JsonOptions {
  limit?: string; // e.g., '1mb'
}

export function json(options: JsonOptions = {}) {
  const limit = options.limit || '1mb';

  return async (ctx: Context, next: () => Promise<any>) => {
    if (ctx.req.method !== 'GET' && ctx.req.method !== 'HEAD') {
      const contentType = ctx.req.headers['content-type'] as string;
      if (contentType && contentType.includes('application/json')) {
        try {
          const bodyStr = ctx.req.body as string;
          if (bodyStr) {
            ctx.req.body = JSON.parse(bodyStr);
          }
        } catch (err) {
          ctx.res.status = 400;
          ctx.res.body = 'Invalid JSON';
          return;
        }
      }
    }
    await next();
  };
}