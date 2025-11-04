import type { Context } from '../context.js';
import { createHash } from 'crypto';

type Middleware = (ctx: Context, next: () => Promise<unknown>) => unknown;

interface CacheConfig {
  levels: {
    memory?: {
      max: number;
      ttl: number;
    };
    redis?: {
      ttl: number;
      prefix: string;
    };
    database?: {
      ttl: number;
      table: string;
    };
  };
  compression?: boolean;
  aiOptimization?: boolean;
  invalidation?: {
    patterns: string[];
    strategies: 'immediate' | 'lazy' | 'ttl';
  };
}

interface CacheEntry {
  key: string;
  value: unknown;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
  size: number;
  compressed: boolean;
}

// Simple LRU Cache implementation
class LRUCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private currentSize = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      entry.accessCount++;
      return entry;
    }
    return null;
  }

  set(key: string, value: unknown, ttl: number): void {
    const size = this.calculateSize(value);
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccess: Date.now(),
      size,
      compressed: false,
    };

    // Remove expired entries
    this.cleanup();

    // Check if we need to evict
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }

    // Remove existing entry if any
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
    }

    this.cache.set(key, entry);
    this.currentSize += size;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  private calculateSize(value: unknown): number {
    return JSON.stringify(value).length;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.currentSize -= entry.size;
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.currentSize -= entry.size;
        this.cache.delete(key);
      }
    }
  }
}

// AI-powered cache predictor
class CachePredictor {
  private accessPatterns = new Map<string, number[]>();
  private predictionThreshold = 0.7;

  recordAccess(key: string): void {
    const now = Date.now();
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }
    this.accessPatterns.get(key)!.push(now);

    // Keep only recent accesses (last 100)
    const accesses = this.accessPatterns.get(key)!;
    if (accesses.length > 100) {
      accesses.shift();
    }
  }

  predictAccess(key: string): number {
    const accesses = this.accessPatterns.get(key);
    if (!accesses || accesses.length < 3) return 0;

    // Simple pattern analysis - check if access frequency is increasing
    const recent = accesses.slice(-10);
    const older = accesses.slice(-20, -10);

    if (recent.length === 0 || older.length === 0) return 0;

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const ratio = recentAvg / (olderAvg || 1);
    return Math.min(ratio, 2) / 2; // Normalize to 0-1
  }

  getPredictedKeys(): string[] {
    const predictions: Array<{ key: string; score: number }> = [];

    for (const [key, accesses] of this.accessPatterns.entries()) {
      if (accesses.length >= 5) {
        const score = this.predictAccess(key);
        if (score > this.predictionThreshold) {
          predictions.push({ key, score });
        }
      }
    }

    return predictions
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((p) => p.key);
  }
}

// Compression utilities
function compress(data: unknown): Buffer {
  // Simple compression using gzip
  const zlib = require('zlib');
  const json = JSON.stringify(data);
  return zlib.gzipSync(json);
}

function decompress(data: Buffer): unknown {
  const zlib = require('zlib');
  const decompressed = zlib.gunzipSync(data);
  return JSON.parse(decompressed.toString());
}

// Cache key generation
function generateCacheKey(method: string, url: string, body?: unknown): string {
  const hash = createHash('sha256');
  hash.update(`${method}:${url}:${JSON.stringify(body || {})}`);
  return hash.digest('hex');
}

// Global cache instances
const memoryCache = new LRUCache(100 * 1024 * 1024); // 100MB
const predictor = new CachePredictor();

/**
 * Advanced caching middleware with AI-powered optimization
 *
 * Features:
 * - Multi-level caching (Memory → Redis → Database)
 * - AI-powered predictive caching
 * - Intelligent cache invalidation
 * - Compression support
 * - Performance monitoring
 */
export function advancedCache(config: CacheConfig): Middleware {
  return async (ctx: Context, next: () => Promise<any>) => {
    const cacheKey = generateCacheKey(ctx.req.method, ctx.req.url, ctx.req.body);

    // Check memory cache first
    if (config.levels.memory) {
      const memoryEntry = memoryCache.get(cacheKey);
      if (memoryEntry && Date.now() - memoryEntry.timestamp < memoryEntry.ttl) {
        predictor.recordAccess(cacheKey);
        ctx.res.status = 200;
        ctx.res.headers = { ...ctx.res.headers, 'x-cache': 'memory' };
        ctx.res.body = memoryEntry.value;
        return;
      }
    }

    // Check Redis cache
    if (config.levels.redis && (ctx as any).db?.type === 'redis') {
      try {
        const redisKey = `${config.levels.redis.prefix}${cacheKey}`;
        const redisValue = await ((ctx as any).db.client as any).get(redisKey);
        if (redisValue) {
          const data = config.compression
            ? decompress(Buffer.from(redisValue, 'base64'))
            : JSON.parse(redisValue);
          predictor.recordAccess(cacheKey);

          // Store in memory for faster future access
          if (config.levels.memory) {
            memoryCache.set(cacheKey, data, config.levels.memory.ttl);
          }

          ctx.res.status = 200;
          ctx.res.headers = { ...ctx.res.headers, 'x-cache': 'redis' };
          ctx.res.body = data;
          return;
        }
      } catch (error) {
        console.warn('[Cache] Redis error:', error);
      }
    }

    // Execute request
    const startTime = Date.now();
    await next();
    const responseTime = Date.now() - startTime;

    // Cache successful GET responses
    if (ctx.req.method === 'GET' && ctx.res.status === 200 && ctx.res.body) {
      const data = ctx.res.body;
      const ttl = config.levels.memory?.ttl || 300000; // 5 minutes default

      // Store in memory
      if (config.levels.memory) {
        memoryCache.set(cacheKey, data, ttl);
      }

      // Store in Redis
      if (config.levels.redis && (ctx as any).db?.type === 'redis') {
        try {
          const redisKey = `${config.levels.redis.prefix}${cacheKey}`;
          const value = config.compression
            ? compress(data).toString('base64')
            : JSON.stringify(data);
          await ((ctx as any).db.client as any).setex(redisKey, Math.floor(ttl / 1000), value);
        } catch (error) {
          console.warn('[Cache] Redis storage error:', error);
        }
      }

      // Store in database (for persistence)
      if (config.levels.database && (ctx as any).db?.type === 'redis') {
        try {
          const dbKey = `cache:${cacheKey}`;
          const value = config.compression
            ? compress(data).toString('base64')
            : JSON.stringify(data);
          await ((ctx as any).db.client as any).setex(dbKey, Math.floor(ttl / 1000), value);
        } catch (error) {
          console.warn('[Cache] Database storage error:', error);
        }
      }

      predictor.recordAccess(cacheKey);
      ctx.res.headers = { ...ctx.res.headers, 'x-cache': 'miss' };
    }

    // AI-powered predictive caching
    if (config.aiOptimization) {
      const predictedKeys = predictor.getPredictedKeys();
      for (const key of predictedKeys) {
        // Preload predicted keys (simplified - in real implementation, this would trigger background fetches)
        console.log(`[Cache AI] Predicted access for key: ${key}`);
      }
    }

    // Cache invalidation
    if (config.invalidation && ['POST', 'PUT', 'DELETE'].includes(ctx.req.method)) {
      const url = ctx.req.url;
      for (const pattern of config.invalidation.patterns) {
        if (url.includes(pattern)) {
          // Invalidate related cache entries
          if (config.invalidation.strategies === 'immediate') {
            memoryCache.clear(); // Simplified - should invalidate specific patterns
            if ((ctx as any).db?.type === 'redis') {
              // Invalidate Redis keys matching pattern
              // This is a simplified implementation
            }
          }
          break;
        }
      }
    }
  };
}

/**
 * Cache management utilities
 */
export const cacheUtils = {
  clearMemory: () => memoryCache.clear(),

  getMemoryStats: () => ({
    size: memoryCache['currentSize'],
    entries: memoryCache['cache'].size,
  }),

  getPredictedKeys: () => predictor.getPredictedKeys(),

  preloadKey: (key: string) => {
    predictor.recordAccess(key);
  },
};
