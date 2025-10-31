import Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  distributed?: boolean; // Enable distributed caching
  instanceId?: string; // Unique instance identifier
  pubSubChannel?: string; // Channel for cache invalidation
}

export class RedisCache {
  private redis: any;
  private pubSubRedis: any;
  private defaultTTL: number;
  private keyPrefix: string;
  private distributed: boolean;
  private instanceId: string;
  private pubSubChannel: string;

  constructor(options: { host?: string; port?: number; password?: string; ttl?: number; keyPrefix?: string; distributed?: boolean; instanceId?: string; pubSubChannel?: string } = {}) {
    this.redis = new (Redis as any)({
      host: options.host || 'localhost',
      port: options.port || 6379,
      password: options.password,
    });
    this.defaultTTL = options.ttl || 3600; // 1 hour default
    this.keyPrefix = options.keyPrefix || 'openspeed:';
    this.distributed = options.distributed || false;
    this.instanceId = options.instanceId || `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.pubSubChannel = options.pubSubChannel || 'cache_invalidation';

    if (this.distributed) {
      this.setupDistributedCache();
    }
  }

  private setupDistributedCache(): void {
    // Create separate Redis connection for pub/sub
    this.pubSubRedis = new (Redis as any)({
      host: this.redis.options.host,
      port: this.redis.options.port,
      password: this.redis.options.password,
    });

    this.pubSubRedis.subscribe(this.pubSubChannel);
    this.pubSubRedis.on('message', (channel: string, message: string) => {
      if (channel === this.pubSubChannel) {
        const data = JSON.parse(message);
        if (data.instanceId !== this.instanceId) {
          // Invalidate local cache for the key
          this.redis.del(this.getKey(data.key));
        }
      }
    });
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  // Basic cache operations
  async get(key: string): Promise<any> {
    const value = await this.redis.get(this.getKey(key));
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const expiry = ttl || this.defaultTTL;
    await this.redis.setex(this.getKey(key), expiry, serialized);

    if (this.distributed) {
      // Notify other instances to invalidate this key
      this.publishInvalidation(key);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(this.getKey(key));

    if (this.distributed) {
      this.publishInvalidation(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(this.getKey(key));
    return result === 1;
  }

  // Cache-aside pattern
  async getOrSet(key: string, fetcher: () => Promise<any>, options?: CacheOptions): Promise<any> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, options?.ttl);
    return value;
  }

  // Write-through pattern
  async setAndPersist(key: string, value: any, persister: (value: any) => Promise<void>, options?: CacheOptions): Promise<void> {
    await persister(value);
    await this.set(key, value, options?.ttl);
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Advanced operations
  async getMultiple(keys: string[]): Promise<any[]> {
    const redisKeys = keys.map(key => this.getKey(key));
    const values = await this.redis.mget(...redisKeys);
    return values.map((value: any) => value ? JSON.parse(value) : null);
  }

  async setMultiple(entries: { key: string; value: any; ttl?: number }[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    entries.forEach(({ key, value, ttl }) => {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      pipeline.setex(this.getKey(key), expiry, serialized);
    });
    await pipeline.exec();
  }

  // Pub/Sub for cache invalidation
  async publish(channel: string, message: any): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    this.redis.subscribe(channel);
    this.redis.on('message', (ch: any, message: any) => {
      if (ch === channel) {
        callback(JSON.parse(message));
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    if (this.pubSubRedis) {
      await this.pubSubRedis.quit();
    }
  }

  private publishInvalidation(key: string): void {
    if (this.pubSubRedis) {
      this.pubSubRedis.publish(this.pubSubChannel, JSON.stringify({
        instanceId: this.instanceId,
        key,
        timestamp: Date.now()
      }));
    }
  }
}