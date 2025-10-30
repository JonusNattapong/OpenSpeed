import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../src/openspeed/plugins/error.js';
import Context from '../../src/openspeed/context.js';

const createCtx = () =>
  new Context({
    method: 'GET',
    url: 'http://localhost/',
    headers: {}
  });

describe('errorHandler plugin', () => {
  it('captures errors and sets default response', async () => {
    const ctx = createCtx();
    const mw = errorHandler();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mw(ctx, async () => {
      throw new Error('boom');
    });

    expect(ctx.res.status).toBe(500);
    expect(ctx.res.body).toBe('Internal Server Error');
    errSpy.mockRestore();
  });

  it('invokes custom error handler', async () => {
    const spy = vi.fn();
    const ctx = createCtx();
    const mw = errorHandler({ onError: spy });

    await mw(ctx, async () => {
      throw new Error('boom');
    });

    expect(spy).toHaveBeenCalled();
  });
});
