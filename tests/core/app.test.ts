import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/openspeed/index.js';
import Context from '../../src/openspeed/context.js';
import { vi } from 'vitest';

const baseReq = (path: string, method = 'GET') => ({
  method,
  url: `http://localhost${path}`,
  headers: {},
});

describe('createApp', () => {
  it('applies global middleware before route handler', async () => {
    const app = createApp();
    const steps: string[] = [];

    app.use(async (_ctx: Context, next: () => Promise<any>) => {
      steps.push('global');
      return next();
    });

    app.get('/hello', (ctx: Context) => {
      steps.push('handler');
      return ctx.text('ok');
    });

    const res = await app.handle(baseReq('/hello'));
    expect(res.body).toBe('ok');
    expect(steps).toEqual(['global', 'handler']);
  });

  it('supports route-level middleware chaining', async () => {
    const app = createApp();
    const order: string[] = [];

    const mw1 = async (_ctx: Context, next: () => Promise<any>) => {
      order.push('mw1');
      return next();
    };
    const mw2 = async (_ctx: Context, next: () => Promise<any>) => {
      order.push('mw2');
      return next();
    };

    app.get('/chain', mw1, mw2, (ctx: Context) => {
      order.push('handler');
      return ctx.text('done');
    });

    const res = await app.handle(baseReq('/chain'));
    expect(res.body).toBe('done');
    expect(order).toEqual(['mw1', 'mw2', 'handler']);
  });

  it('returns 404 for unknown routes', async () => {
    const app = createApp();
    const res = await app.handle(baseReq('/missing'));
    expect(res.status).toBe(404);
  });

  it('exposes registered routes metadata', () => {
    const app = createApp();
    app.get('/hello', (ctx: Context) => ctx.text('hi'));
    app.post('/users', (ctx: Context) => ctx.json({}));

    const routes = app.routes();
    expect(routes).toEqual(
      expect.arrayContaining([
        { method: 'GET', path: '/hello', middlewares: [] },
        { method: 'POST', path: '/users', middlewares: [] },
      ])
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    app.printRoutes();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
