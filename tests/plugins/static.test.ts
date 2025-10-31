import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serveStatic } from '../../src/openspeed/plugins/static.js';
import Context from '../../src/openspeed/context.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('static plugin', () => {
  const testDir = join(process.cwd(), 'test-static');
  
  beforeAll(() => {
    // Create test directory and files
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'test.txt'), 'Hello World');
    writeFileSync(join(testDir, 'test.html'), '<h1>Test</h1>');
    mkdirSync(join(testDir, 'subdir'), { recursive: true });
    writeFileSync(join(testDir, 'subdir', 'index.html'), '<h1>Index</h1>');
  });

  afterAll(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should serve static files', async () => {
    const middleware = serveStatic({
      root: testDir,
      prefix: '/static'
    });

    const req: any = {
      method: 'GET',
      url: 'http://localhost/static/test.txt',
      headers: {}
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(ctx.res.body).toEqual(Buffer.from('Hello World'));
    expect(ctx.res.headers['Content-Type']).toBe('text/plain');
  });

  it('should serve HTML files with correct content type', async () => {
    const middleware = serveStatic({
      root: testDir,
      prefix: '/static'
    });

    const req: any = {
      method: 'GET',
      url: 'http://localhost/static/test.html',
      headers: {}
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {});

    expect(ctx.res.body).toEqual(Buffer.from('<h1>Test</h1>'));
    expect(ctx.res.headers['Content-Type']).toBe('text/html');
  });

  it('should serve index.html for directories', async () => {
    const middleware = serveStatic({
      root: testDir,
      prefix: '/static'
    });

    const req: any = {
      method: 'GET',
      url: 'http://localhost/static/subdir/',
      headers: {}
    };
    const ctx = new Context(req, {});

    await middleware(ctx, async () => {});

    expect(ctx.res.body).toEqual(Buffer.from('<h1>Index</h1>'));
  });

  it('should prevent directory traversal', async () => {
    const middleware = serveStatic({
      root: testDir,
      prefix: '/static'
    });

    const req: any = {
      method: 'GET',
      url: 'http://localhost/static/../../../etc/passwd',
      headers: {}
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    // URL normalization means the path becomes /etc/passwd which doesn't start with /static
    // so the middleware should pass through to next()
    expect(nextCalled).toBe(true);
  });

  it('should pass through for non-matching paths', async () => {
    const middleware = serveStatic({
      root: testDir,
      prefix: '/static'
    });

    const req: any = {
      method: 'GET',
      url: 'http://localhost/api/test',
      headers: {}
    };
    const ctx = new Context(req, {});

    let nextCalled = false;
    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('should handle ETag caching', async () => {
    const middleware = serveStatic({
      root: testDir,
      prefix: '/static',
      etag: true
    });

    // First request to get ETag
    const req1: any = {
      method: 'GET',
      url: 'http://localhost/static/test.txt',
      headers: {}
    };
    const ctx1 = new Context(req1, {});
    await middleware(ctx1, async () => {});
    
    const etag = ctx1.res.headers['ETag'];
    expect(etag).toBeDefined();

    // Second request with ETag
    const req2: any = {
      method: 'GET',
      url: 'http://localhost/static/test.txt',
      headers: {
        'if-none-match': etag
      }
    };
    const ctx2 = new Context(req2, {});
    await middleware(ctx2, async () => {});

    expect(ctx2.res.status).toBe(304);
  });
});
