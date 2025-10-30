import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { createApp, type RouteMiddleware } from '../../src/openspeed/index.js';

const baseReq = (path: string, method = 'GET') => ({
  method,
  url: `http://localhost${path}`,
  headers: {}
});

describe('createApp', () => {
  it('applies global middleware before route handler', async () => {
    const app = createApp();
    const steps: string[] = [];

    app.use(async (_ctx, next) => {
      steps.push('global');
      return next();
    });

    app.get('/hello', (ctx) => {
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

    const mw1: RouteMiddleware<'/chain'> = async (_ctx, next) => {
      order.push('mw1');
      return next();
    };
    const mw2: RouteMiddleware<'/chain'> = async (_ctx, next) => {
      order.push('mw2');
      return next();
    };

    app.get('/chain', mw1, mw2, (ctx) => {
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
    app.get('/hello', (ctx) => ctx.text('hi'));
    app.post('/users', (ctx) => ctx.json({}));

    const routes = app.routes();
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'GET', path: '/hello', middlewares: [] }),
        expect.objectContaining({ method: 'POST', path: '/users', middlewares: [] })
      ])
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    app.printRoutes();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('supports route groups with scoped middleware and typed params', async () => {
    const app = createApp();
    const signals: string[] = [];

    app.group('/api', (group) => {
      group.use(async (_ctx, next) => {
        signals.push('group');
        return next();
      });
      group.get('/users/:id', (ctx) => {
        signals.push(ctx.params.id);
        expectTypeOf(ctx.params.id).toEqualTypeOf<string>();
        return ctx.json({ id: ctx.params.id });
      });
    });

    const res = await app.handle(baseReq('/api/users/42'));
    expect(res.status).toBe(200);
    expect(res.body).toBe(JSON.stringify({ id: '42' }));
    expect(signals).toEqual(['group', '42']);
  });

  it('infers params from route templates', () => {
    const app = createApp();
    app.get('/orders/:orderId/items/:itemId', (ctx) => {
      expectTypeOf(ctx.params.orderId).toEqualTypeOf<string>();
      expectTypeOf(ctx.params.itemId).toEqualTypeOf<string>();
      return ctx.json({});
    });
  });
});
