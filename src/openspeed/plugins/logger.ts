import type { Context } from '../context.js';

export interface LoggerOptions {
  format?: (ctx: Context, ms: number) => string;
  json?: boolean;
}

export function logger(options: LoggerOptions = {}) {
  const { json = false } = options;
  const format = options.format || ((ctx, ms) => {
    const requestId = (ctx as any).requestId || 'unknown';
    const status = (ctx.res as any).status || 200;
    const message = `${ctx.req.method} ${ctx.req.url} - ${status} - ${ms}ms`;

    if (json) {
      return JSON.stringify({
        level: 'info',
        message,
        requestId,
        method: ctx.req.method,
        url: ctx.req.url,
        status,
        duration: ms,
        timestamp: new Date().toISOString(),
      });
    }
    return `[${requestId}] ${message}`;
  });

  return async (ctx: Context, next: () => Promise<any>) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(format(ctx, ms));
  };
}