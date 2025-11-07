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

  it('serves client.php via middleware', async () => {
    const api = openapi();
    api.collect('GET', '/users', 'list users');
    const ctx = req('http://localhost/client.php');

    await api.middleware(ctx, async () => {
      throw new Error('should not call next');
    });

    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers?.['content-type']).toBe('text/plain');
    expect(ctx.res.body).toContain('class OpenSpeedClient');
    expect(ctx.res.body).toContain('<?php');
  });

  it('serves client.cpp via middleware', async () => {
    const api = openapi();
    api.collect('GET', '/users', 'list users');
    const ctx = req('http://localhost/client.cpp');

    await api.middleware(ctx, async () => {
      throw new Error('should not call next');
    });

    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers?.['content-type']).toBe('text/plain');
    expect(ctx.res.body).toContain('class OpenSpeedClient');
    expect(ctx.res.body).toContain('#include <iostream>');
  });

  it('serves client.rs via middleware', async () => {
    const api = openapi();
    api.collect('GET', '/users', 'list users');
    const ctx = req('http://localhost/client.rs');

    await api.middleware(ctx, async () => {
      throw new Error('should not call next');
    });

    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers?.['content-type']).toBe('text/plain');
    expect(ctx.res.body).toContain('pub struct OpenSpeedClient');
    expect(ctx.res.body).toContain('use reqwest');
  });

  it('serves client.go via middleware', async () => {
    const api = openapi();
    api.collect('GET', '/users', 'list users');
    const ctx = req('http://localhost/client.go');

    await api.middleware(ctx, async () => {
      throw new Error('should not call next');
    });

    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers?.['content-type']).toBe('text/plain');
    expect(ctx.res.body).toContain('type OpenSpeedClient struct');
    expect(ctx.res.body).toContain('package main');
  });

  it('generates client with path parameters', () => {
    const api = openapi();
    api.collect('GET', '/users/:id', {
      parameters: [{ name: 'id', in: 'path', schema: z.string() }],
      responses: { '200': { schema: z.object({ name: z.string() }) } },
    });
    const client = api.generateClient();

    expect(client).toContain("import { z } from 'zod';");
    expect(client).toContain('export type users_$idPathParams = {id: any};');
    expect(client).toContain(
      'async users_$id(pathParams: users_$idPathParams, options?: {headers?: Record<string, string>; auth?: string}): Promise<users_$idResponse>'
    );
    expect(client).toContain('url = `${this.baseURL}/users/${pathParams.id}`;');
    expect(client).toContain('users_$idResponseSchema.parse(data);');
  });

  it('generates client with query parameters', () => {
    const api = openapi();
    api.collect('GET', '/users', {
      parameters: [{ name: 'limit', in: 'query', schema: z.number() }],
      responses: { '200': { schema: z.array(z.string()) } },
    });
    const client = api.generateClient();

    expect(client).toContain('export type usersQueryParams = {limit?: any};');
    expect(client).toContain(
      'async users(queryParams?: usersQueryParams, options?: {headers?: Record<string, string>; auth?: string}): Promise<usersResponse>'
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

    expect(client).toContain('export type usersRequest = any;');
    expect(client).toContain(
      'async users(body: usersRequest, options?: {headers?: Record<string, string>; auth?: string}): Promise<usersResponse>'
    );
    expect(client).toContain('body: JSON.stringify(body)');
    expect(client).toContain("headers['Content-Type'] = 'application/json';");
  });

  it('generates client with auth and headers', () => {
    const api = openapi();
    api.collect('GET', '/protected', 'protected route');
    const client = api.generateClient();

    expect(client).toContain("if (options?.auth) headers['Authorization'] = options.auth;");
    expect(client).toContain('const headers: Record<string, string> = { ...options?.headers };');
  });

  it('generates PHP client', () => {
    const api = openapi();
    api.collect('GET', '/users/:id', {
      parameters: [{ name: 'id', in: 'path', schema: z.string() }],
    });
    const client = api.generateClient('php');

    expect(client).toContain('<?php');
    expect(client).toContain('class OpenSpeedClient');
    expect(client).toContain('public function users_$id($pathParams, $options = [])');
    expect(client).toContain('$url = $this->baseURL . "/users/{id}";');
    expect(client).toContain("$url = str_replace('{id}', $pathParams['id'], $url);");
    expect(client).toContain('curl_exec($ch)');
  });

  it('generates C++ client', () => {
    const api = openapi();
    api.collect('POST', '/users', {
      requestBody: z.object({ name: z.string() }),
    });
    const client = api.generateClient('cpp');

    expect(client).toContain('#include <iostream>');
    expect(client).toContain('class OpenSpeedClient');
    expect(client).toContain('nlohmann::json users(nlohmann::json body = nullptr');
    expect(client).toContain('curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body_str.c_str())');
    expect(client).toContain('return nlohmann::json::parse(response_string)');
  });

  it('generates Rust client', () => {
    const api = openapi();
    api.collect('POST', '/users', {
      requestBody: z.object({ name: z.string() }),
    });
    const client = api.generateClient('rust');

    expect(client).toContain('use reqwest');
    expect(client).toContain('pub struct OpenSpeedClient');
    expect(client).toContain('pub async fn users');
    expect(client).toContain('self.client.post(url)');
    expect(client).toContain('Ok(json)');
  });

  it('generates Go client', () => {
    const api = openapi();
    api.collect('POST', '/users', {
      requestBody: z.object({ name: z.string() }),
    });
    const client = api.generateClient('go');

    expect(client).toContain('package main');
    expect(client).toContain('type OpenSpeedClient struct');
    expect(client).toContain('func (c *OpenSpeedClient) users');
    expect(client).toContain('http.NewRequest("POST"');
    expect(client).toContain('return result, nil');
  });

  it('generates Python client', () => {
    const api = openapi();
    api.collect('POST', '/users', {
      requestBody: z.object({ name: z.string() }),
    });
    const client = api.generateClient('python');

    expect(client).toContain('# Generated OpenSpeed Python Client');
    expect(client).toContain('import requests');
    expect(client).toContain('class OpenSpeedClient');
    expect(client).toContain('def users(self');
    expect(client).toContain('response.raise_for_status()');
    expect(client).toContain('return response.json()');
  });

  it('serves client.py via middleware', async () => {
    const api = openapi();
    api.collect('GET', '/users', 'list users');
    const ctx = req('http://localhost/client.py');

    await api.middleware(ctx, async () => {
      throw new Error('should not call next');
    });

    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers?.['content-type']).toBe('text/plain');
    expect(ctx.res.body).toContain('class OpenSpeedClient');
    expect(ctx.res.body).toContain('import requests');
  });

  it('supports custom language registration', () => {
    const api = openapi();

    // Register a custom language
    api.registerLanguage('customlang', (routes) => {
      return `// Custom language client\n${routes.length} routes`;
    });

    api.collect('GET', '/test', 'test route');

    const client = api.generateClient('customlang');
    expect(client).toBe('// Custom language client\n1 routes');
  });

  it('handles unsupported language error', () => {
    const api = openapi();
    expect(() => api.generateClient('unsupported')).toThrow('Unsupported language: unsupported');
  });

  it('serves custom language client via middleware', async () => {
    const api = openapi();

    api.registerLanguage('testlang', () => 'custom client code');

    const ctx = req('http://localhost/client.testlang');

    await api.middleware(ctx, async () => {
      throw new Error('should not call next');
    });

    expect(ctx.res.status).toBe(200);
    expect(ctx.res.headers?.['content-type']).toBe('text/plain');
    expect(ctx.res.body).toBe('custom client code');
  });

  it('returns error for unsupported language via middleware', async () => {
    const api = openapi();
    const ctx = req('http://localhost/client.unsupported');

    await api.middleware(ctx, async () => {
      throw new Error('should not call next');
    });

    expect(ctx.res.status).toBe(400);
    expect(ctx.res.headers?.['content-type']).toBe('application/json');
    const body = JSON.parse(ctx.res.body);
    expect(body.error).toContain('Unsupported language: unsupported');
  });
});
