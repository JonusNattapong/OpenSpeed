import type { Context } from '../context.js';

export interface LoggerOptions {
  format?: (ctx: Context, ms: number) => string;
}

export function logger(options: LoggerOptions = {}) {
  const format = options.format || ((ctx, ms) => `${ctx.req.method} ${ctx.req.url} - ${ms}ms`);

  return async (ctx: Context, next: () => Promise<any>) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(format(ctx, ms));
  };
}