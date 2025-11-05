import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cachePlugin } from '../../src/openspeed/plugins/cache.js';
import type { Context } from '../../src/openspeed/context.js';

describe('Cache Plugin', () => {
  let mockCtx: Context;
  let next: () => Promise<any>;
  let cache: any;

  beforeEach(() => {
    mockCtx = {
      req: {
        url: 'http://localhost:3000/api/users',
        method: 'GET',
        headers: {},
      },
      res: {
        status: undefined,
        headers: {},
        body: undefined,
      },
    } as any;

    next = vi.fn().mockResolvedValue(undefined);
  });

  beforeAll(() => {
    cache = cachePlugin();
  });

  describe('Basic Caching', () => {
    it('should cache GET responses', async () => {
      const middleware = cache.middleware;

      // First request - cache miss
      mockCtx.res.status = 200;
      mockCtx.res.body = { users: ['alice', 'bob'] };
      await middleware(mockCtx, next);

      expect(next).toHaveBeenCalled();
      expect(mockCtx.res.headers['x-cache']).toBe('MISS');

      // Second request - cache hit
      const newCtx = { ...mockCtx };
      newCtx.res = { status: undefined, headers: {}, body: undefined };
      await middleware(newCtx, next);

      expect(next).toHaveBeenCalledTimes(1); // Only first call
      expect(newCtx.res.headers['x-cache']).toBe('HIT');
      expect(newCtx.res.body).toEqual({ users: ['alice', 'bob'] });
      expect(newCtx.cacheHit).toBe(true);
    });

    it('should not cache non-GET requests by default', async () => {
      const middleware = cache.middleware;

      mockCtx.req.method = 'POST';
      mockCtx.res.status = 201;
      mockCtx.res.body = { id: 1 };

      await middleware(mockCtx, next);

      expect(next).toHaveBeenCalled();
      expect(mockCtx.res.headers['x-cache']).toBeUndefined();
    });

    it('should not cache error responses', async () => {
      const middleware = cache.middleware;

      mockCtx.res.status = 500;
      mockCtx.res.body = { error: 'Internal Server Error' };

      await middleware(mockCtx, next);

      expect(next).toHaveBeenCalled();

      // Second request should not be cached
      const newCtx = { ...mockCtx };
      newCtx.res = { status: undefined, headers: {}, body: undefined };
      await middleware(newCtx, next);

      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect TTL for cached entries', async () => {
      const ttlCache = cachePlugin({ defaultTtl: 100 }); // 100ms TTL
      const middleware = ttlCache.middleware;

      // First request
      mockCtx.res.status = 200;
      mockCtx.res.body = { data: 'fresh' };
      await middleware(mockCtx, next);

      // Immediate second request - should hit cache
      const immediateCtx = { ...mockCtx };
      immediateCtx.res = { status: undefined, headers: {}, body: undefined };
      await middleware(immediateCtx, next);

      expect(immediateCtx.res.headers['x-cache']).toBe('HIT');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Third request - should miss cache
      const expiredCtx = { ...mockCtx };
      expiredCtx.res = { status: undefined, headers: {}, body: undefined };
      await middleware(expiredCtx, next);

      expect(expiredCtx.res.headers['x-cache']).toBe('MISS');
    });
  });

  describe('Custom Key Generator', () => {
    it('should use custom key generator', async () => {
      const customKeyGen = vi.fn((ctx: Context) => `custom:${ctx.req.method}:${ctx.req.url}`);
      const customCache = cachePlugin({ keyGenerator: customKeyGen });
      const middleware = customCache.middleware;

      await middleware(mockCtx, next);

      expect(customKeyGen).toHaveBeenCalledWith(mockCtx);
    });

    it('should differentiate cache keys based on query parameters', async () => {
      const queryCache = cachePlugin();
      const middleware = queryCache.middleware;

      // First request with query
      mockCtx.req.url = 'http://localhost:3000/api/users?page=1';
      mockCtx.res.status = 200;
      mockCtx.res.body = { page: 1 };
      await middleware(mockCtx, next);

      // Second request with different query
      const newCtx = { ...mockCtx };
      newCtx.req.url = 'http://localhost:3000/api/users?page=2';
      newCtx.res = { status: undefined, headers: {}, body: undefined };
      await middleware(newCtx, next);

      expect(newCtx.res.headers['x-cache']).toBe('MISS');
    });
  });

  describe('Skip Cache Condition', () => {
    it('should skip caching based on custom condition', async () => {
      const skipCache = vi.fn((ctx: Context) => ctx.req.headers['x-no-cache'] === 'true');
      const skipCacheInstance = cachePlugin({ skipCache });
      const middleware = skipCacheInstance.middleware;

      mockCtx.req.headers['x-no-cache'] = 'true';
      await middleware(mockCtx, next);

      expect(skipCache).toHaveBeenCalledWith(mockCtx);
      expect(mockCtx.res.headers['x-cache']).toBeUndefined();
    });
  });

  describe('Cache Management', () => {
    it('should allow manual cache operations', async () => {
      // Set cache manually
      await cache.set('manual-key', { data: 'manual' });

      const value = await cache.get('manual-key');
      expect(value).toEqual({ data: 'manual' });

      // Check size
      const size = await cache.size();
      expect(size).toBeGreaterThan(0);

      // Delete cache
      const deleted = await cache.delete('manual-key');
      expect(deleted).toBe(true);

      const afterDelete = await cache.get('manual-key');
      expect(afterDelete).toBeNull();

      // Clear all
      await cache.clear();
      const finalSize = await cache.size();
      expect(finalSize).toBe(0);
    });

    it('should track cache statistics', async () => {
      const middleware = cache.middleware;

      // First request - miss
      mockCtx.res.status = 200;
      mockCtx.res.body = { data: 'test' };
      await middleware(mockCtx, next);

      // Second request - hit
      const hitCtx = { ...mockCtx };
      hitCtx.res = { status: undefined, headers: {}, body: undefined };
      await middleware(hitCtx, next);

      const stats = cache.stats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
    });
  });

  describe('Cache Headers', () => {
    it('should add cache headers when enabled', async () => {
      const headerCache = cachePlugin({ cacheHeaders: true });
      const middleware = headerCache.middleware;

      await middleware(mockCtx, next);

      expect(mockCtx.res.headers['x-cache']).toBe('MISS');
      expect(mockCtx.res.headers['x-cache-time']).toBeDefined();
    });

    it('should not add cache headers when disabled', async () => {
      const noHeaderCache = cachePlugin({ cacheHeaders: false });
      const middleware = noHeaderCache.middleware;

      await middleware(mockCtx, next);

      expect(mockCtx.res.headers['x-cache']).toBeUndefined();
      expect(mockCtx.res.headers['x-cache-time']).toBeUndefined();
    });
  });

  describe('Redis Store (Mock)', () => {
    it('should work with Redis-like store', async () => {
      const mockRedis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        setex: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        exists: vi.fn().mockResolvedValue(1),
        keys: vi.fn().mockResolvedValue(['key1']),
        flushdb: vi.fn().mockResolvedValue('OK'),
      };

      const redisCache = cachePlugin({ store: 'redis', redis: mockRedis });
      const middleware = redisCache.middleware;

      await middleware(mockCtx, next);

      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });
});
