import { describe, it, expect } from 'vitest';
import Context from '../../src/openspeed/context.js';

describe('Context', () => {
  const baseReq = { method: 'GET', url: 'http://localhost/', headers: {} };

  it('sets JSON responses with status and header', () => {
    const ctx = new Context(baseReq);
    const res = ctx.json({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(res.headers?.['content-type']).toBe('application/json');
    expect(res.body).toBe(JSON.stringify({ ok: true }));
  });

  it('sets text responses with status and header', () => {
    const ctx = new Context(baseReq);
    const res = ctx.text('hello', 202);
    expect(res.status).toBe(202);
    expect(res.headers?.['content-type']).toContain('text/plain');
    expect(res.body).toBe('hello');
  });

  it('merges headers across calls', () => {
    const ctx = new Context(baseReq);
    ctx.text('first');
    ctx.json({ ok: true });
    expect(ctx.res.headers).toMatchObject({
      'content-type': 'application/json'
    });
  });
});

