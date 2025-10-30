import { describe, it, expect } from 'vitest';
import { openapi } from '../../src/openspeed/plugins/openapi.js';
import Context from '../../src/openspeed/context.js';

const req = (url: string) =>
  new Context({
    method: 'GET',
    url,
    headers: {}
  });

describe('openapi plugin', () => {
  it('collects routes and generates spec', () => {
    const api = openapi({ title: 'Test', version: '0.0.1' });
    api.collect('GET', '/users/:id', 'fetch user');

    const spec = api.generate();
    expect(spec.info.title).toBe('Test');
    expect(spec.paths['/users/{id}'].get.description).toBe('fetch user');
  });

  it('serves openapi.json via middleware', async () => {
    const api = openapi();
    api.collect('GET', '/users', 'list users');
    const ctx = req('http://localhost/openapi.json');

    await api.middleware(ctx, async () => {
      throw new Error('should not call next');
    });

    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers?.['content-type']).toBe('application/json');
    expect(ctx.res.body).toContain('"paths"');
  });
});

