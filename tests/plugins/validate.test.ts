import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validate } from '../../src/openspeed/plugins/validate.js';
import Context from '../../src/openspeed/context.js';

describe('validate plugin', () => {
  it('validates body, params, query, headers', async () => {
    const mw = validate({
      body: z.object({ message: z.string() }),
      params: z.object({ id: z.string() }),
      query: z.object({ foo: z.string() }),
      headers: z.object({ authorization: z.string().optional() })
    });

    const ctx = new Context(
      {
        method: 'POST',
        url: 'http://localhost/resource?foo=bar',
        headers: { authorization: 'token' },
        body: { message: 'hi' }
      },
      { id: '123' }
    );

    let called = false;
    await mw(ctx, async () => {
      called = true;
    });

    expect(called).toBe(true);
    expect(ctx.req.body).toEqual({ message: 'hi' });
    expect(ctx.params).toEqual({ id: '123' });
    expect(ctx.req.query).toEqual({ foo: 'bar' });
  });

  it('responds with 400 when validation fails', async () => {
    const mw = validate({
      body: z.object({ message: z.string() })
    });

    const ctx = new Context(
      {
        method: 'POST',
        url: 'http://localhost/resource',
        headers: {},
        body: { message: 123 }
      },
      {}
    );

    let called = false;
    await mw(ctx, async () => {
      called = true;
    });

    expect(called).toBe(false);
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.headers?.['content-type']).toBe('application/json');
    expect(ctx.res.body).toContain('Validation failed');
  });
});
