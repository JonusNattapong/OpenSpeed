import { describe, it, expect } from 'vitest';
import { json } from '../../src/openspeed/plugins/json.js';
import Context from '../../src/openspeed/context.js';

const createCtx = (method: string, body?: any, headers: Record<string, any> = {}) =>
  new Context({
    method,
    url: 'http://localhost/',
    headers,
    body
  });

describe('json plugin', () => {
  it('parses JSON bodies for non-GET requests', async () => {
    const mw = json();
    const ctx = createCtx('POST', JSON.stringify({ ok: true }), { 'content-type': 'application/json' });
    let called = false;

    await mw(ctx, async () => {
      called = true;
    });

    expect(called).toBe(true);
    expect(ctx.req.body).toEqual({ ok: true });
  });

  it('returns 400 on invalid JSON', async () => {
    const mw = json();
    const ctx = createCtx('POST', '{bad json}', { 'content-type': 'application/json' });
    let called = false;

    await mw(ctx, async () => {
      called = true;
    });

    expect(called).toBe(false);
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body).toBe('Invalid JSON');
  });
});

