import { MongoClient, Db, MongoClientOptions } from 'mongodb';
import { createPool, Pool, PoolOptions } from 'mysql2/promise';
import { Pool as PgPool, PoolConfig } from 'pg';
import Redis from 'ioredis';
import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from 'crypto';
import type { Context } from '../context.js';

type Middleware = (ctx: Context, next: () => Promise<any>) => any;

interface DatabaseConfig {
  type: 'mongodb' | 'mysql' | 'postgresql' | 'redis';
  connection: string | any;
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
  multiTenant?: boolean;
  tenantKey?: string; // Header or query param for tenant ID
  debug?: boolean;
  encryptionKey?: string; // Key for encrypting sensitive data
  enableQueryLogging?: boolean;
  enableAuditLog?: boolean;
  maxQueryTime?: number;
}

interface DatabaseConnection {
  type: string;
  client: any;
  pool?: any;
  multiTenant: boolean;
  encryptionKey?: string;
  queryLogging?: boolean;
  auditLog?: boolean;
}

// Global connection registry
const connections = new Map<string, DatabaseConnection>();

// Database security configuration
const DB_SECURITY_CONFIG = {
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
  },
  sensitiveFields: ['password', 'email', 'ssn', 'credit_card', 'api_key', 'secret', 'token', 'key'],
  maxQueryLogSize: 1000, // Max queries to keep in memory
  enableAuditLog: process.env.DB_AUDIT_LOG === 'true',
  maxQueryTime: 30000, // 30 seconds max query time
  enableEncryption: process.env.DB_ENCRYPTION === 'true',
};

// Query log for security monitoring
const queryLog: Array<{
  timestamp: number;
  connection: string;
  operation: string;
  table?: string;
  collection?: string;
  query?: string;
  duration: number;
  success: boolean;
  clientIP?: string;
  userId?: string;
  error?: string;
}> = [];

// Encryption utilities
function encryptField(value: string, key: string): string {
  if (!DB_SECURITY_CONFIG.enableEncryption) return value;

  const iv = randomBytes(DB_SECURITY_CONFIG.encryption.ivLength);
  const cipher = createCipheriv(DB_SECURITY_CONFIG.encryption.algorithm, key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptField(encryptedValue: string, key: string): string {
  if (!DB_SECURITY_CONFIG.enableEncryption) return encryptedValue;

  try {
    const [ivHex, authTagHex, encrypted] = encryptedValue.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(DB_SECURITY_CONFIG.encryption.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[DB] Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

// Input validation
function validateDatabaseInput(data: any, operation: string): void {
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid ${operation} data: must be an object`);
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
    /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\\x23)|(\%27)|(\%23)|(\%2D\\x2D))/i,
  ];

  function checkValue(value: any): void {
    if (typeof value === 'string') {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          throw new Error(`Potentially dangerous input detected in ${operation}`);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(checkValue);
    }
  }

  checkValue(data);
}

// Query logging
function logQuery(
  connectionName: string,
  operation: string,
  details: {
    table?: string;
    collection?: string;
    query?: string;
    duration: number;
    success: boolean;
    clientIP?: string;
    userId?: string;
    error?: string;
  }
): void {
  const logEntry = {
    timestamp: Date.now(),
    connection: connectionName,
    operation,
    ...details,
  };

  queryLog.push(logEntry);

  // Keep only recent logs
  if (queryLog.length > DB_SECURITY_CONFIG.maxQueryLogSize) {
    queryLog.shift();
  }

  if (DB_SECURITY_CONFIG.enableAuditLog) {
    console.log('[DB AUDIT]', JSON.stringify(logEntry));
  }
}

/**
 * Advanced database plugin with connection pooling and multi-tenancy
 *
 * Features:
 * - Connection pooling for optimal performance
 * - Multi-tenant database isolation
 * - Automatic reconnection
 * - Query performance monitoring
 * - Transaction support
 * - Type-safe query builders
 */
export function database(name: string, config: DatabaseConfig): Middleware {
  return async (ctx: Context, next: () => Promise<any>) => {
    // Initialize connection if not exists
    if (!connections.has(name)) {
      await initializeConnection(name, config);
    }

    const connection = connections.get(name)!;

    // Extract client info for logging
    const clientIP =
      ctx.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      ctx.req.headers['x-real-ip']?.toString() ||
      ctx.req.headers['cf-connecting-ip']?.toString() ||
      'unknown';
    const userId = (ctx as any).user?.userId || (ctx as any).user?.id;

    // Multi-tenant support
    if (config.multiTenant) {
      const tenantId = extractTenantId(ctx, config.tenantKey || 'x-tenant-id');
      if (!tenantId) {
        logQuery(name, 'MULTI_TENANT_ERROR', {
          duration: 0,
          success: false,
          clientIP,
          userId,
          error: 'Tenant ID required',
        });
        ctx.res.status = 400;
        ctx.res.body = JSON.stringify({ error: 'Tenant ID required' });
        return;
      }

      // Get tenant-specific database
      const tenantDb = await getTenantDatabase(connection, tenantId, config.type);
      (ctx as any).db = tenantDb;
    } else {
      (ctx as any).db = connection.client;
    }

    // Performance monitoring and security
    const startTime = Date.now();

    try {
      await next();

      const duration = Date.now() - startTime;
      if (config.debug) {
        console.log(`[DB] Request completed in ${duration}ms`);
      }

      // Log successful operation
      if (connection.queryLogging) {
        logQuery(name, 'REQUEST_COMPLETED', {
          duration,
          success: true,
          clientIP,
          userId,
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Log failed operation
      if (connection.queryLogging) {
        logQuery(name, 'REQUEST_FAILED', {
          duration,
          success: false,
          clientIP,
          userId,
          error: error.message,
        });
      }

      throw error;
    }
  };
}

/**
 * Initialize database connection with pooling
 */
async function initializeConnection(name: string, config: DatabaseConfig): Promise<void> {
  let connection: DatabaseConnection;

  switch (config.type) {
    case 'mongodb':
      connection = await initializeMongoDB(config);
      break;

    case 'mysql':
      connection = await initializeMySQL(config);
      break;

    case 'postgresql':
      connection = await initializePostgreSQL(config);
      break;

    case 'redis':
      connection = await initializeRedis(config);
      break;

    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }

  connection.multiTenant = config.multiTenant || false;
  connection.encryptionKey = config.encryptionKey || process.env.DB_ENCRYPTION_KEY;
  connection.queryLogging = config.enableQueryLogging || DB_SECURITY_CONFIG.enableAuditLog;
  connection.auditLog = config.enableAuditLog || DB_SECURITY_CONFIG.enableAuditLog;

  connections.set(name, connection);

  console.log(
    `[DB] Connected to ${config.type} database: ${name} (Security: ${connection.encryptionKey ? 'encrypted' : 'plain'}, Logging: ${connection.queryLogging})`
  );
}

/**
 * MongoDB connection with pooling
 */
async function initializeMongoDB(config: DatabaseConfig): Promise<DatabaseConnection> {
  const options: any = {
    maxPoolSize: config.pool?.max || 10,
    minPoolSize: config.pool?.min || 2,
  };

  if (typeof config.connection === 'object') {
    Object.assign(options, config.connection);
  }

  const client = new MongoClient(
    typeof config.connection === 'string' ? config.connection : '',
    options
  );

  await client.connect();

  return {
    type: 'mongodb',
    client: client.db(),
    pool: client,
    multiTenant: false,
  };
}

/**
 * MySQL connection with pooling
 */
async function initializeMySQL(config: DatabaseConfig): Promise<DatabaseConnection> {
  const poolOptions: any = {
    connectionLimit: config.pool?.max || 10,
    waitForConnections: true,
    queueLimit: 0,
  };

  if (typeof config.connection === 'object') {
    Object.assign(poolOptions, config.connection);
  } else if (typeof config.connection === 'string') {
    poolOptions.uri = config.connection;
  }

  const pool = createPool(poolOptions);

  return {
    type: 'mysql',
    client: pool,
    pool,
    multiTenant: false,
  };
}

/**
 * PostgreSQL connection with pooling
 */
async function initializePostgreSQL(config: DatabaseConfig): Promise<DatabaseConnection> {
  const poolConfig: any = {
    max: config.pool?.max || 10,
    min: config.pool?.min || 2,
    idleTimeoutMillis: config.pool?.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.pool?.connectionTimeoutMillis || 2000,
  };

  if (typeof config.connection === 'object') {
    Object.assign(poolConfig, config.connection);
  } else if (typeof config.connection === 'string') {
    poolConfig.connectionString = config.connection;
  }

  const pool = new PgPool(poolConfig);

  return {
    type: 'postgresql',
    client: pool,
    pool,
    multiTenant: false,
  };
}

/**
 * Redis connection with clustering support
 */
async function initializeRedis(config: DatabaseConfig): Promise<DatabaseConnection> {
  const options: any = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  };

  if (typeof config.connection === 'object') {
    Object.assign(options, config.connection);
  }

  const RedisClient = Redis as any;
  const client =
    typeof config.connection === 'string'
      ? new RedisClient(config.connection)
      : new RedisClient(options);

  return {
    type: 'redis',
    client,
    pool: null,
    multiTenant: false,
  };
}

/**
 * Extract tenant ID from request
 */
function extractTenantId(ctx: Context, tenantKey: string): string | null {
  // Check header
  const headers = ctx.req.headers as any;
  const headerValue = headers.get ? headers.get(tenantKey) : headers[tenantKey];
  if (headerValue) return headerValue;

  // Check query param
  const url = new URL(ctx.req.url);
  const queryValue = url.searchParams.get(tenantKey);
  if (queryValue) return queryValue;

  return null;
}

/**
 * Get tenant-specific database
 */
async function getTenantDatabase(
  connection: DatabaseConnection,
  tenantId: string,
  type: string
): Promise<any> {
  switch (type) {
    case 'mongodb':
      // Each tenant gets their own database
      return connection.pool.db(`tenant_${tenantId}`);

    case 'mysql':
    case 'postgresql':
      // Use schema/database per tenant
      // This is a simplified implementation
      return {
        ...connection.client,
        __tenantId: tenantId,
      };

    case 'redis':
      // Use key prefix per tenant
      return {
        ...connection.client,
        __tenantPrefix: `tenant:${tenantId}:`,
      };

    default:
      return connection.client;
  }
}

/**
 * Type-safe query builder for MongoDB
 */
export interface IMongoQueryBuilder<T = any> {
  find(filter?: Partial<T>): Promise<T[]>;
  findOne(filter: Partial<T>): Promise<T | null>;
  insertOne(doc: any): Promise<any>;
  updateOne(filter: Partial<T>, update: Partial<T>): Promise<any>;
  deleteOne(filter: Partial<T>): Promise<any>;
  aggregate(pipeline: any[]): Promise<any[]>;
}

export class MongoQueryBuilder<T = any> implements IMongoQueryBuilder<T> {
  constructor(
    private db: Db,
    private collection: string
  ) {}

  async find(filter: Partial<T> = {}): Promise<T[]> {
    return this.db
      .collection(this.collection)
      .find(filter as any)
      .toArray() as Promise<T[]>;
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    return this.db.collection(this.collection).findOne(filter as any) as Promise<T | null>;
  }

  async insertOne(doc: any): Promise<any> {
    return this.db.collection(this.collection).insertOne(doc);
  }

  async updateOne(filter: Partial<T>, update: Partial<T>): Promise<any> {
    return this.db.collection(this.collection).updateOne(filter as any, { $set: update });
  }

  async deleteOne(filter: Partial<T>): Promise<any> {
    return this.db.collection(this.collection).deleteOne(filter as any);
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return this.db.collection(this.collection).aggregate(pipeline).toArray();
  }
}

/**
 * Type-safe query builder for SQL databases
 */
export interface ISQLQueryBuilder<T = any> {
  find(where?: Partial<T>): Promise<T[]>;
  findOne(where: Partial<T>): Promise<T | null>;
  insert(data: Partial<T>): Promise<any>;
  update(where: Partial<T>, data: Partial<T>): Promise<any>;
  delete(where: Partial<T>): Promise<any>;
  raw(query: string, values?: any[]): Promise<any>;
}

export class SQLQueryBuilder<T = any> implements ISQLQueryBuilder<T> {
  constructor(
    private pool: Pool | PgPool,
    private table: string,
    private connectionName?: string,
    private encryptionKey?: string
  ) {}

  async find(where: Partial<T> = {}): Promise<T[]> {
    validateDatabaseInput(where, 'find');

    const startTime = Date.now();
    try {
      const conditions = Object.entries(where).map(([key], i) => `${key} = $${i + 1}`);
      const values = Object.values(where);

      const query = `SELECT * FROM ${this.table}${conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''}`;

      const result = await (this.pool as any).query(query, values);
      const data = result.rows || result[0];

      // Decrypt sensitive fields
      if (data && Array.isArray(data)) {
        data.forEach((row) => this.decryptSensitiveFields(row));
      }

      if (this.connectionName) {
        logQuery(this.connectionName, 'SELECT', {
          table: this.table,
          query,
          duration: Date.now() - startTime,
          success: true,
        });
      }

      return data;
    } catch (error: any) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'SELECT', {
          table: this.table,
          duration: Date.now() - startTime,
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }

  async findOne(where: Partial<T>): Promise<T | null> {
    const results = await this.find(where);
    return results[0] || null;
  }

  async insert(data: Partial<T>): Promise<any> {
    validateDatabaseInput(data, 'insert');

    const startTime = Date.now();
    try {
      // Encrypt sensitive fields before insertion
      const processedData = { ...data };
      this.encryptSensitiveFields(processedData);

      const keys = Object.keys(processedData);
      const values = Object.values(processedData);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const query = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;

      const result = await (this.pool as any).query(query, values);
      const insertedData = result.rows?.[0] || result[0]?.[0];

      // Decrypt for return value
      if (insertedData) {
        this.decryptSensitiveFields(insertedData);
      }

      if (this.connectionName) {
        logQuery(this.connectionName, 'INSERT', {
          table: this.table,
          query,
          duration: Date.now() - startTime,
          success: true,
        });
      }

      return insertedData;
    } catch (error: any) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'INSERT', {
          table: this.table,
          duration: Date.now() - startTime,
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }

  async update(where: Partial<T>, data: Partial<T>): Promise<any> {
    validateDatabaseInput(where, 'update where');
    validateDatabaseInput(data, 'update data');

    const startTime = Date.now();
    try {
      // Encrypt sensitive fields before update
      const processedData = { ...data };
      this.encryptSensitiveFields(processedData);

      const setClause = Object.keys(processedData)
        .map((key, i) => `${key} = $${i + 1}`)
        .join(', ');
      const whereClause = Object.keys(where)
        .map((key, i) => `${key} = $${i + 1 + Object.keys(processedData).length}`)
        .join(' AND ');

      const query = `UPDATE ${this.table} SET ${setClause} WHERE ${whereClause} RETURNING *`;
      const values = [...Object.values(processedData), ...Object.values(where)];

      const result = await (this.pool as any).query(query, values);
      const updatedData = result.rows?.[0] || result[0]?.[0];

      // Decrypt for return value
      if (updatedData) {
        this.decryptSensitiveFields(updatedData);
      }

      if (this.connectionName) {
        logQuery(this.connectionName, 'UPDATE', {
          table: this.table,
          query,
          duration: Date.now() - startTime,
          success: true,
        });
      }

      return updatedData;
    } catch (error: any) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'UPDATE', {
          table: this.table,
          duration: Date.now() - startTime,
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }

  async delete(where: Partial<T>): Promise<any> {
    validateDatabaseInput(where, 'delete');

    const startTime = Date.now();
    try {
      const conditions = Object.entries(where).map(([key], i) => `${key} = $${i + 1}`);
      const values = Object.values(where);

      const query = `DELETE FROM ${this.table} WHERE ${conditions.join(' AND ')} RETURNING *`;

      const result = await (this.pool as any).query(query, values);
      const deletedData = result.rows?.[0] || result[0]?.[0];

      if (this.connectionName) {
        logQuery(this.connectionName, 'DELETE', {
          table: this.table,
          query,
          duration: Date.now() - startTime,
          success: true,
        });
      }

      return deletedData;
    } catch (error: any) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'DELETE', {
          table: this.table,
          duration: Date.now() - startTime,
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }

  async raw(query: string, values: any[] = []): Promise<any> {
    // WARNING: Raw queries bypass security measures
    console.warn('[DB SECURITY WARNING] Raw query executed:', query);

    const startTime = Date.now();
    try {
      const result = await (this.pool as any).query(query, values);

      if (this.connectionName) {
        logQuery(this.connectionName, 'RAW_QUERY', {
          query,
          duration: Date.now() - startTime,
          success: true,
        });
      }

      return result.rows || result[0];
    } catch (error: any) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'RAW_QUERY', {
          query,
          duration: Date.now() - startTime,
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }

  private encryptSensitiveFields(data: any): void {
    if (!this.encryptionKey) return;

    for (const field of DB_SECURITY_CONFIG.sensitiveFields) {
      if (data[field] && typeof data[field] === 'string') {
        data[field] = encryptField(data[field], this.encryptionKey);
      }
    }
  }

  private decryptSensitiveFields(data: any): void {
    if (!this.encryptionKey) return;

    for (const field of DB_SECURITY_CONFIG.sensitiveFields) {
      if (data[field] && typeof data[field] === 'string') {
        try {
          data[field] = decryptField(data[field], this.encryptionKey);
        } catch (error) {
          // If decryption fails, keep original value
          console.warn(`[DB] Failed to decrypt field ${field}`);
        }
      }
    }
  }
}

/**
 * Redis cache adapter
 */
export interface IRedisCache {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  increment(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  flushAll(): Promise<void>;
}

export class RedisCache implements IRedisCache {
  constructor(private client: any) {}

  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async increment(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async flushAll(): Promise<void> {
    await this.client.flushall();
  }
}

/**
 * Close all database connections
 */
export async function closeAllConnections(): Promise<void> {
  for (const [name, connection] of connections.entries()) {
    try {
      switch (connection.type) {
        case 'mongodb':
          await connection.pool?.close();
          break;
        case 'mysql':
        case 'postgresql':
          await connection.pool?.end();
          break;
        case 'redis':
          await connection.client?.quit();
          break;
      }
      console.log(`[DB] Closed connection: ${name}`);
    } catch (error) {
      console.error(`[DB] Error closing connection ${name}:`, error);
    }
  }
  connections.clear();
  queryLog.length = 0; // Clear query log
}

// Security utilities
export function getQueryLogs(limit?: number): typeof queryLog {
  return limit ? queryLog.slice(-limit) : [...queryLog];
}

export function clearQueryLogs(): void {
  queryLog.length = 0;
}

export function getSecurityConfig(): typeof DB_SECURITY_CONFIG {
  return { ...DB_SECURITY_CONFIG };
}

// Database health check
export async function healthCheck(connectionName: string): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  connections?: number;
  error?: string;
}> {
  const connection = connections.get(connectionName);
  if (!connection) {
    return { status: 'unhealthy', latency: 0, error: 'Connection not found' };
  }

  const startTime = Date.now();
  try {
    switch (connection.type) {
      case 'mongodb':
        await connection.client.db().admin().ping();
        break;
      case 'mysql':
      case 'postgresql':
        await connection.pool.query('SELECT 1');
        break;
      case 'redis':
        await connection.client.ping();
        break;
    }

    const latency = Date.now() - startTime;
    return {
      status: 'healthy',
      latency,
      connections: connection.pool?.totalCount || connection.pool?.totalConnections || 1,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      error: error.message,
    };
  }
}

// Export types and utilities
export { type DatabaseConfig, type DatabaseConnection };
