import { describe, it, expect } from 'vitest';
import { cors } from '../../src/openspeed/plugins/cors.js';
import Context from '../../src/openspeed/context.js';

const createCtx = (origin = 'http://example.com', method = 'GET') =>
  new Context({
    method,
    url: 'http://localhost/',
    headers: { origin }
  });

describe('cors plugin', () => {
  it('sets default CORS headers', async () => {
    const mw = cors();
    const ctx = createCtx();

    await mw(ctx, async () => {});

    expect(ctx.res.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(ctx.res.headers?.['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('honors allowed origin array', async () => {
    const mw = cors({ origin: ['http://allowed.com'] });
    const ctx = createCtx('http://allowed.com');

    await mw(ctx, async () => {});

    expect(ctx.res.headers?.['Access-Control-Allow-Origin']).toBe('http://allowed.com');
  });

  it('short-circuits OPTIONS requests', async () => {
    const mw = cors();
    const ctx = createCtx('http://allowed.com', 'OPTIONS');

    let called = false;
    await mw(ctx, async () => {
      called = true;
    });

    expect(called).toBe(false);
    expect(ctx.res.status).toBe(200);
  });
});

