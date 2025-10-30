import type { Context } from '../context.js';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message?: string;
  statusCode?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (ctx: Context) => string;
  store?: RateLimitStore;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | undefined>;
  set(key: string, entry: RateLimitEntry): Promise<void>;
  clear?(): Promise<void>;
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (ctx: Context) => ctx.req.headers['x-forwarded-for'] as string || 'anonymous',
    store = new MemoryStore()
  } = options;

  return async (ctx: Context, next: () => Promise<any>) => {
    const key = keyGenerator(ctx);
    const now = Date.now();
    const windowStart = now - windowMs;

    let entry = await store.get(key);
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + windowMs };
      await store.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count >= max) {
      const resetIn = Math.ceil((entry.resetTime - now) / 1000);
      ctx.res.status = statusCode;
      ctx.res.headers = {
        ...ctx.res.headers,
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': entry.resetTime.toString(),
        'Retry-After': resetIn.toString()
      };
      ctx.res.body = JSON.stringify({
        error: message,
        retryAfter: resetIn
      });
      return;
    }

    // Increment counter
    entry.count++;
    await store.set(key, entry);

    try {
      await next();

      // Skip successful requests if configured
      if (skipSuccessfulRequests && ctx.res.status && ctx.res.status < 400) {
        entry.count--;
        await store.set(key, entry);
      }
    } catch (error) {
      // Skip failed requests if configured
      if (skipFailedRequests) {
        entry.count--;
        await store.set(key, entry);
      }
      throw error;
    }
  };
}

// Memory store for rate limiting (in production, use Redis or similar)
export class MemoryStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  async get(key: string): Promise<RateLimitEntry | undefined> {
    const entry = this.store.get(key);
    if (entry && entry.resetTime < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async set(key: string, entry: RateLimitEntry): Promise<void> {
    this.store.set(key, entry);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}