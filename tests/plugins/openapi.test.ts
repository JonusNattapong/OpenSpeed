import { describe, it, expect } from 'vitest';
import { openapi } from '../../src/openspeed/plugins/openapi.js';
import { z } from 'zod';
import Context from '../../src/openspeed/context.js';

const req = (url: string) =>
  new Context({
    method: 'GET',
    url,
    headers: {},
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

  it('serves client.ts via middleware', async () => {
    const api = openapi();
    api.collect('GET', '/users', 'list users');
    const ctx = req('http://localhost/client.ts');

    await api.middleware(ctx, async () => {
      throw new Error('should not call next');
    });

    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers?.['content-type']).toBe('text/plain');
    expect(ctx.res.body).toContain('OpenSpeedClient');
  });

  it('generates client with path parameters', () => {
    const api = openapi();
    api.collect('GET', '/users/:id', {
      parameters: [{ name: 'id', in: 'path', schema: z.string() }],
      responses: { '200': { schema: z.object({ name: z.string() }) } },
    });
    const client = api.generateClient();

    expect(client).toContain("import { z } from 'zod';");
    expect(client).toContain('export type rootPathParams = {id: string};');
    expect(client).toContain(
      'async root(pathParams: rootPathParams, options?: {headers?: Record<string, string>; auth?: string}): Promise<rootResponse>'
    );
    expect(client).toContain('url = `${this.baseURL}/users/${pathParams.id}`;');
    expect(client).toContain('rootResponseSchema.parse(data);');
  });

  it('generates client with query parameters', () => {
    const api = openapi();
    api.collect('GET', '/users', {
      parameters: [{ name: 'limit', in: 'query', schema: z.number() }],
      responses: { '200': { schema: z.array(z.string()) } },
    });
    const client = api.generateClient();

    expect(client).toContain('export type rootQueryParams = {limit?: number};');
    expect(client).toContain(
      'async root(queryParams?: rootQueryParams, options?: {headers?: Record<string, string>; auth?: string}): Promise<rootResponse>'
    );
    expect(client).toContain(
      "if (queryParams.limit !== undefined) searchParams.append('limit', String(queryParams.limit));"
    );
  });

  it('generates client with request body', () => {
    const api = openapi();
    api.collect('POST', '/users', {
      requestBody: z.object({ name: z.string() }),
      responses: { '200': { schema: z.object({ id: z.number() }) } },
    });
    const client = api.generateClient();

    expect(client).toContain('export type rootRequest = {name: string};');
    expect(client).toContain(
      'async root(body: rootRequest, options?: {headers?: Record<string, string>; auth?: string}): Promise<rootResponse>'
    );
    expect(client).toContain('body: JSON.stringify(body)');
    expect(client).toContain("headers['Content-Type'] = 'application/json';");
  });

  it('generates client with auth and headers', () => {
    const api = openapi();
    api.collect('GET', '/protected', 'protected route');
    const client = api.generateClient();

    expect(client).toContain("if (options?.auth) headers['Authorization'] = options.auth;");
    expect(client).toContain('headers: { ...options?.headers }');
  });
});
