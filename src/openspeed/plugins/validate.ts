import { z } from 'zod';
import type { Context } from '../context.js';

export interface ValidationOptions {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
  query?: z.ZodSchema;
  headers?: z.ZodSchema;
}

export function validate(options: ValidationOptions) {
  return async (ctx: Context, next: () => Promise<any>) => {
    try {
      if (options.body && ctx.req.body) {
        ctx.req.body = options.body.parse(ctx.req.body);
      }
      if (options.params) {
        ctx.params = options.params.parse(ctx.params) as Record<string, string>;
      }
      if (options.query) {
        // parse query from url
        const url = new URL(ctx.req.url, 'http://localhost');
        const query: Record<string, string> = {};
        for (const [k, v] of url.searchParams) {
          query[k] = v;
        }
        ctx.req.query = options.query.parse(query) as Record<string, string>;
      }
      if (options.headers) {
        ctx.req.headers = options.headers.parse(ctx.req.headers) as Record<string, string | string[] | undefined>;
      }
      await next();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        ctx.res.status = 400;
        ctx.res.body = JSON.stringify({ error: 'Validation failed', details: err.issues });
        ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
        return;
      }
      throw err;
    }
  };
}