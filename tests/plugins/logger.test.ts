import { describe, it, expect, vi } from 'vitest';
import { logger } from '../../src/openspeed/plugins/logger.js';
import Context from '../../src/openspeed/context.js';

const ctx = new Context({
  method: 'GET',
  url: 'http://localhost/',
  headers: {}
});

describe('logger plugin', () => {
  it('logs formatted output after next', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mw = logger({ format: () => 'custom log' });

    await mw(ctx, async () => {});

    expect(spy).toHaveBeenCalledWith('custom log');
    spy.mockRestore();
  });
});

