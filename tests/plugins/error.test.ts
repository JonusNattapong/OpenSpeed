import { describe, it, expect, vi } from 'vitest';
import { errorHandler, HttpError } from '../../src/openspeed/plugins/errorHandler.js';
import Context from '../../src/openspeed/context.js';

const createCtx = () =>
  new Context({
    method: 'GET',
    url: 'http://localhost/',
    headers: { accept: 'application/json' },
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
    expect(ctx.res.headers!['Content-Type']).toBe('application/json');
    const body = JSON.parse(ctx.res.body as string);
    expect(body.error.message).toBe('Internal Server Error');
    expect(body.error.status).toBe(500);
    errSpy.mockRestore();
  });

  it('handles HttpError with custom status', async () => {
    const ctx = createCtx();
    const mw = errorHandler();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mw(ctx, async () => {
      throw new HttpError(404, 'Not Found');
    });

    expect(ctx.res.status).toBe(404);
    const body = JSON.parse(ctx.res.body as string);
    expect(body.error.message).toBe('Not Found');
    expect(body.error.status).toBe(404);
    errSpy.mockRestore();
  });

  it('invokes custom error transformation', async () => {
    const transformError = vi.fn((error: Error) => ({
      custom: 'error',
      message: error.message,
    }));
    const ctx = createCtx();
    const mw = errorHandler({ transformError });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mw(ctx, async () => {
      throw new Error('boom');
    });

    expect(transformError).toHaveBeenCalled();
    const body = JSON.parse(ctx.res.body as string);
    expect(body.custom).toBe('error');
    expect(body.message).toBe('boom');
    errSpy.mockRestore();
  });

  it('can disable error logging', async () => {
    const ctx = createCtx();
    const mw = errorHandler({ logErrors: false });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mw(ctx, async () => {
      throw new Error('boom');
    });

    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('can expose stack trace', async () => {
    const ctx = createCtx();
    const mw = errorHandler({ exposeStack: true, developmentMode: true });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mw(ctx, async () => {
      throw new Error('boom');
    });

    const body = JSON.parse(ctx.res.body as string);
    expect(body.error.stack).toBeDefined();
    errSpy.mockRestore();
  });
});
