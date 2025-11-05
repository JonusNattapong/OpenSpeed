import type { Context } from '../context.js';

// Cache storage interfaces
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl?: number;
}

export interface ResponseCacheEntry {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
}

// In-memory cache implementation
class MemoryCache implements CacheStore {
  private cache = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async size(): Promise<number> {
    // Clean expired entries
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}

// Redis cache implementation (requires redis client)
class RedisCache implements CacheStore {
  constructor(private redis: any) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[CACHE] Redis get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, Math.floor(ttl / 1000), serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      console.error('[CACHE] Redis set error:', error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      console.error('[CACHE] Redis delete error:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error('[CACHE] Redis clear error:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('[CACHE] Redis has error:', error);
      return false;
    }
  }

  async size(): Promise<number> {
    try {
      const keys = await this.redis.keys('*');
      return keys.length;
    } catch (error) {
      console.error('[CACHE] Redis size error:', error);
      return 0;
    }
  }
}

// Cache plugin options
export interface CacheOptions {
  store?: 'memory' | 'redis';
  redis?: any; // Redis client instance
  defaultTtl?: number; // Default TTL in milliseconds
  keyGenerator?: (ctx: Context) => string;
  skipCache?: (ctx: Context) => boolean;
  cacheHeaders?: boolean; // Cache response headers
  compression?: boolean; // Compress cached data
  maxSize?: number; // Max cache size for memory store
}

// Main cache plugin
export function cachePlugin(options: CacheOptions = {}) {
  const {
    store = 'memory',
    redis,
    defaultTtl = 300000, // 5 minutes
    keyGenerator = defaultKeyGenerator,
    skipCache = defaultSkipCache,
    cacheHeaders = true,
    compression = false,
    maxSize,
  } = options;

  // Initialize cache store
  let cacheStore: CacheStore;
  if (store === 'redis' && redis) {
    cacheStore = new RedisCache(redis);
  } else {
    cacheStore = new MemoryCache();
  }

  // Cache statistics
  const stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  // Cache management methods
  return {
    middleware: async (ctx: Context, next: () => Promise<any>) => {
      // Skip caching if condition met
      if (skipCache(ctx)) {
        return next();
      }

      // Generate cache key
      const cacheKey = keyGenerator(ctx);

      // Try to get from cache
      const cached = await cacheStore.get<ResponseCacheEntry>(cacheKey);
      if (cached) {
        stats.hits++;
        ctx.cacheHit = true;

        // Restore cached response
        ctx.res.status = cached.status || 200;
        ctx.res.headers = { ...ctx.res.headers, ...cached.headers };
        ctx.res.body = cached.body;

        // Add cache headers
        if (cacheHeaders) {
          ctx.res.headers = {
            ...ctx.res.headers,
            'x-cache': 'HIT',
            'x-cache-time': new Date().toISOString(),
          };
        }

        return;
      }

      stats.misses++;

      // Execute request
      await next();

      // Cache the response if successful
      if (ctx.res.status && ctx.res.status < 400 && ctx.res.body !== undefined) {
        const cacheEntry = {
          status: ctx.res.status,
          headers: cacheHeaders ? ctx.res.headers : {},
          body: ctx.res.body,
        };

        await cacheStore.set(cacheKey, cacheEntry, defaultTtl);
        stats.sets++;

        // Add cache headers
        if (cacheHeaders) {
          ctx.res.headers = {
            ...ctx.res.headers,
            'x-cache': 'MISS',
            'x-cache-time': new Date().toISOString(),
          };
        }
      }
    },
    get: (key: string) => cacheStore.get(key),
    set: (key: string, value: any, ttl?: number) => cacheStore.set(key, value, ttl),
    delete: (key: string) => cacheStore.delete(key),
    clear: () => cacheStore.clear(),
    has: (key: string) => cacheStore.has(key),
    size: () => cacheStore.size(),
    stats: () => ({ ...stats }),
  };
}

// Default key generator
function defaultKeyGenerator(ctx: Context): string {
  const url = new URL(ctx.req.url);
  const method = ctx.req.method || 'GET';
  const query = url.search;
  const body = ctx.req.method === 'POST' && ctx.req.body ? JSON.stringify(ctx.req.body) : '';

  return `${method}:${url.pathname}${query}${body}`;
}

// Default skip cache function
function defaultSkipCache(ctx: Context): boolean {
  // Skip caching for non-GET requests by default
  return ctx.req.method !== 'GET';
}

// Export utilities
export { cachePlugin as cache };
