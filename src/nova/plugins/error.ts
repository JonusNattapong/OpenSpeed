import type { Context } from '../context.js';

export interface ErrorHandlerOptions {
  onError?: (err: any, ctx: Context) => void;
}

export function errorHandler(options: ErrorHandlerOptions = {}) {
  const onError = options.onError || ((err, ctx) => {
    console.error(err);
    ctx.res.status = 500;
    ctx.res.body = 'Internal Server Error';
  });

  return async (ctx: Context, next: () => Promise<any>) => {
    try {
      await next();
    } catch (err) {
      onError(err, ctx);
    }
  };
}