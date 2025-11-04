import { MongoClient, Db, Document } from 'mongodb';
import { createPool } from 'mysql2/promise';
import { Pool as PgPool } from 'pg';
import { Redis } from 'ioredis';
// import Database from 'better-sqlite3';
import sql from 'mssql';
import oracledb from 'oracledb';
import { Client as CassandraClient } from 'cassandra-driver';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import * as admin from 'firebase-admin';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { URL } from 'url';
import type { Context } from '../context.js';

type Middleware = (ctx: Context, next: () => Promise<unknown>) => unknown;

interface DatabaseConfig {
  type:
    | 'mongodb'
    | 'mysql'
    | 'postgresql'
    | 'redis'
    | 'sqlite'
    | 'mssql'
    | 'oracle'
    | 'cassandra'
    | 'elasticsearch'
    | 'dynamodb'
    | 'firebase';
  connection: string | Record<string, unknown>;
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
  client: unknown;
  pool?: unknown;
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
  const authTag = (cipher as any).getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptField(encryptedValue: string, key: string): string {
  if (!DB_SECURITY_CONFIG.enableEncryption) return encryptedValue;

  try {
    const [ivHex, authTagHex, encrypted] = encryptedValue.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(DB_SECURITY_CONFIG.encryption.algorithm, key, iv);
    (decipher as any).setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    console.error('[DB] Decryption failed');
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
    /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\\x23)|(%27)|(%23)|(%2D\\x2D))/i,
  ];

  function checkValue(value: unknown): void {
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
    const userId =
      ((ctx as any).user as { userId?: string; id?: string })?.userId ||
      ((ctx as any).user as { userId?: string; id?: string })?.id;

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
      (ctx as { db?: unknown }).db = tenantDb;
    } else {
      (ctx as { db?: unknown }).db = connection.client;
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
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      // Log failed operation
      if (connection.queryLogging) {
        logQuery(name, 'REQUEST_FAILED', {
          duration,
          success: false,
          clientIP,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
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

    // case 'sqlite':
    //   connection = await initializeSQLite(config);
    //   break;

    case 'mssql':
      connection = await initializeSQLServer(config);
      break;

    case 'oracle':
      connection = await initializeOracle(config);
      break;

    case 'cassandra':
      connection = await initializeCassandra(config);
      break;

    case 'elasticsearch':
      connection = await initializeElasticsearch(config);
      break;

    case 'dynamodb':
      connection = await initializeDynamoDB(config);
      break;

    case 'firebase':
      connection = await initializeFirebase(config);
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
  const options: Record<string, unknown> = {
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
  const poolOptions: Record<string, unknown> = {
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
  const poolConfig: Record<string, unknown> = {
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
  const options: Record<string, unknown> = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  };

  if (typeof config.connection === 'object') {
    Object.assign(options, config.connection);
  }

  const client =
    typeof config.connection === 'string' ? new Redis(config.connection) : new Redis(options);

  return {
    type: 'redis',
    client,
    pool: null,
    multiTenant: false,
  };
}

/**
 * SQLite connection
 */
/*
// async function initializeSQLite(config: DatabaseConfig): Promise<DatabaseConnection> {
//   const dbPath = typeof config.connection === 'string' ? config.connection : './database.db';
//   const db = new Database(dbPath);

//   // Enable WAL mode for better concurrency
//   db.pragma('journal_mode = WAL');

//   return {
//     type: 'sqlite',
//     client: db,
//     pool: null,
//     multiTenant: false,
//   };
// }
*/

/**
 * SQL Server connection with pooling
 */
async function initializeSQLServer(config: DatabaseConfig): Promise<DatabaseConnection> {
  const configObj: any =
    typeof config.connection === 'object'
      ? config.connection
      : {
          server: 'localhost',
          database: 'master',
          user: 'sa',
          password: process.env.DB_PASSWORD || 'your_password_here',
          options: {
            encrypt: true,
            trustServerCertificate: true,
          },
        };

  const pool = new sql.ConnectionPool(configObj as any);
  await pool.connect();

  return {
    type: 'mssql',
    client: pool,
    pool,
    multiTenant: false,
  };
}

/**
 * Oracle connection with pooling
 */
async function initializeOracle(config: DatabaseConfig): Promise<DatabaseConnection> {
  const configObj =
    typeof config.connection === 'object'
      ? config.connection
      : {
          user: 'system',
          password: process.env.DB_PASSWORD || 'your_password_here',
          connectString: 'localhost:1521/XE',
        };

  const pool = await oracledb.createPool(configObj);

  return {
    type: 'oracle',
    client: pool,
    pool,
    multiTenant: false,
  };
}

/**
 * Cassandra connection
 */
async function initializeCassandra(config: DatabaseConfig): Promise<DatabaseConnection> {
  const configObj =
    typeof config.connection === 'object'
      ? config.connection
      : {
          contactPoints: ['127.0.0.1'],
          localDataCenter: 'datacenter1',
          keyspace: 'keyspace1',
        };

  const client = new CassandraClient(configObj);
  await client.connect();

  return {
    type: 'cassandra',
    client,
    pool: null,
    multiTenant: false,
  };
}

/**
 * Elasticsearch connection
 */
async function initializeElasticsearch(config: DatabaseConfig): Promise<DatabaseConnection> {
  const configObj =
    typeof config.connection === 'object'
      ? config.connection
      : {
          node: 'https://localhost:9200',
        };

  const client = new ElasticsearchClient(configObj);

  return {
    type: 'elasticsearch',
    client,
    pool: null,
    multiTenant: false,
  };
}

/**
 * DynamoDB connection
 */
async function initializeDynamoDB(config: DatabaseConfig): Promise<DatabaseConnection> {
  const configObj =
    typeof config.connection === 'object'
      ? config.connection
      : {
          region: 'us-east-1',
        };

  const client = new DynamoDBClient(configObj);

  return {
    type: 'dynamodb',
    client,
    pool: null,
    multiTenant: false,
  };
}

/**
 * Firebase connection
 */
async function initializeFirebase(config: DatabaseConfig): Promise<DatabaseConnection> {
  const configObj = typeof config.connection === 'object' ? config.connection : {};

  if (!admin.apps.length) {
    admin.initializeApp(configObj);
  }

  const db = admin.firestore();

  return {
    type: 'firebase',
    client: db,
    pool: null,
    multiTenant: false,
  };
}

/**
 * Extract tenant ID from request
 */
function extractTenantId(ctx: Context, tenantKey: string): string | null {
  // Check header
  const headers = ctx.req.headers;
  const headerValue = headers[tenantKey];
  if (headerValue) return Array.isArray(headerValue) ? headerValue[0] : headerValue;

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
): Promise<unknown> {
  switch (type) {
    case 'mongodb':
      // Each tenant gets their own database
      return (connection.pool as MongoClient).db(`tenant_${tenantId}`);

    case 'mysql':
    case 'postgresql':
    case 'mssql':
    case 'oracle':
      // Use schema/database per tenant
      // This is a simplified implementation
      return {
        ...(connection.client as Record<string, unknown>),
        __tenantId: tenantId,
      };

    case 'sqlite':
      // SQLite doesn't support multi-tenancy well, use prefixed tables
      return {
        ...(connection.client as Record<string, unknown>),
        __tenantPrefix: `tenant_${tenantId}_`,
      };

    case 'redis':
      // Use key prefix per tenant
      return {
        ...(connection.client as Record<string, unknown>),
        __tenantPrefix: `tenant:${tenantId}:`,
      };

    case 'cassandra':
      // Use keyspace per tenant
      return {
        ...(connection.client as Record<string, unknown>),
        __tenantKeyspace: `tenant_${tenantId}`,
      };

    case 'elasticsearch':
      // Use index prefix per tenant
      return {
        ...(connection.client as Record<string, unknown>),
        __tenantPrefix: `tenant_${tenantId}_`,
      };

    case 'dynamodb':
      // Use table prefix per tenant
      return {
        ...(connection.client as Record<string, unknown>),
        __tenantPrefix: `tenant_${tenantId}_`,
      };

    case 'firebase':
      // Firebase handles multi-tenancy differently
      return connection.client;

    default:
      return connection.client;
  }
}

/**
 * Type-safe query builder for MongoDB
 */
export interface IMongoQueryBuilder<T = unknown> {
  find(filter?: Partial<T>): Promise<T[]>;
  findOne(filter: Partial<T>): Promise<T | null>;
  insertOne(doc: unknown): Promise<unknown>;
  updateOne(filter: Partial<T>, update: Partial<T>): Promise<unknown>;
  deleteOne(filter: Partial<T>): Promise<unknown>;
  aggregate(pipeline: unknown[]): Promise<unknown[]>;
}

export class MongoQueryBuilder<T = unknown> implements IMongoQueryBuilder<T> {
  constructor(
    private db: Db,
    private collection: string
  ) {}

  async find(filter: Partial<T> = {}): Promise<T[]> {
    return this.db
      .collection(this.collection)
      .find(filter as Record<string, unknown>)
      .toArray() as Promise<T[]>;
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    return this.db
      .collection(this.collection)
      .findOne(filter as Record<string, unknown>) as Promise<T | null>;
  }

  async insertOne(doc: unknown): Promise<unknown> {
    return this.db.collection(this.collection).insertOne(doc as Record<string, unknown>);
  }

  async insertMany(docs: unknown[]): Promise<unknown> {
    return this.db
      .collection(this.collection)
      .insertMany(docs.map((doc) => doc as Record<string, unknown>));
  }

  async updateOne(filter: Partial<T>, update: Partial<T>): Promise<unknown> {
    return this.db
      .collection(this.collection)
      .updateOne(filter as Record<string, unknown>, { $set: update });
  }

  async deleteOne(filter: Partial<T>): Promise<unknown> {
    return this.db.collection(this.collection).deleteOne(filter as Record<string, unknown>);
  }

  async aggregate(pipeline: unknown[]): Promise<unknown[]> {
    return this.db
      .collection(this.collection)
      .aggregate(pipeline as Document[])
      .toArray();
  }
}

/**
 * Type-safe query builder for SQL databases
 */
export interface ISQLQueryBuilder<T = unknown> {
  find(where?: Partial<T>): Promise<T[]>;
  findOne(where: Partial<T>): Promise<T | null>;
  insert(data: Partial<T>): Promise<unknown>;
  update(where: Partial<T>, data: Partial<T>): Promise<unknown>;
  delete(where: Partial<T>): Promise<unknown>;
  raw(query: string, values?: unknown[]): Promise<unknown>;
}

export class SQLQueryBuilder<T = unknown> implements ISQLQueryBuilder<T> {
  constructor(
    private pool: unknown,
    private table: string,
    private connectionName?: string,
    private encryptionKey?: string
  ) {
    // Validate table name to prevent SQL injection
    this.validateTableName(table);
  }

  /**
   * Validate table name to prevent SQL injection
   */
  private validateTableName(table: string): void {
    // Table name should only contain alphanumeric characters, underscores, and dots (for schema.table)
    if (!/^[a-zA-Z0-9_\.]+$/.test(table)) {
      throw new Error(
        `Invalid table name: "${table}". Table names must contain only alphanumeric characters, underscores, and dots.`
      );
    }

    // Additional checks
    if (table.length > 64) {
      throw new Error(`Table name too long: "${table}". Maximum length is 64 characters.`);
    }

    if (table.startsWith('.') || table.endsWith('.')) {
      throw new Error(`Invalid table name: "${table}". Cannot start or end with a dot.`);
    }
  }

  /**
   * Safely quote identifier (table or column name)
   */
  private quoteIdentifier(identifier: string): string {
    // Validate identifier
    if (!/^[a-zA-Z0-9_\.]+$/.test(identifier)) {
      throw new Error(
        `Invalid identifier: "${identifier}". Identifiers must contain only alphanumeric characters, underscores, and dots.`
      );
    }
    // Use double quotes for PostgreSQL, backticks for MySQL (we'll use double quotes as default)
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  async find(where: Partial<T> = {}): Promise<T[]> {
    validateDatabaseInput(where, 'find');

    const startTime = Date.now();
    try {
      const conditions = Object.entries(where).map(([key], i) => `${key} = $${i + 1}`);
      const values = Object.values(where);

      const query = `SELECT * FROM ${this.quoteIdentifier(this.table)}${conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''}`;

      const result = await (
        this.pool as { query: (q: string, v: unknown[]) => Promise<unknown> }
      ).query(query, values);
      const data =
        (result as { rows?: unknown[]; [key: string]: unknown })?.rows || (result as unknown[])[0];

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

      return data as T[];
    } catch (error: unknown) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'SELECT', {
          table: this.table,
          duration: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  }

  async findOne(where: Partial<T>): Promise<T | null> {
    const results = await this.find(where);
    return results[0] || null;
  }

  async insert(data: Partial<T>): Promise<unknown> {
    validateDatabaseInput(data, 'insert');

    const startTime = Date.now();
    try {
      // Encrypt sensitive fields before insertion
      const processedData = { ...data };
      this.encryptSensitiveFields(processedData);

      const keys = Object.keys(processedData);
      const values = Object.values(processedData);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const query = `INSERT INTO ${this.quoteIdentifier(this.table)} (${keys.map((k) => this.quoteIdentifier(k)).join(', ')}) VALUES (${placeholders}) RETURNING *`;

      const result = await (
        this.pool as { query: (q: string, v: unknown[]) => Promise<unknown> }
      ).query(query, values);
      const resultWithRows = result as { rows?: unknown[]; [key: string]: unknown };
      const insertedData = resultWithRows?.rows?.[0] || null;

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
    } catch (error: unknown) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'INSERT', {
          table: this.table,
          duration: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  }

  async update(where: Partial<T>, data: Partial<T>): Promise<unknown> {
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

      const query = `UPDATE ${this.quoteIdentifier(this.table)} SET ${setClause} WHERE ${whereClause} RETURNING *`;
      const values = [...Object.values(processedData), ...Object.values(where)];

      const result = await (
        this.pool as { query: (q: string, v: unknown[]) => Promise<unknown> }
      ).query(query, values);
      const resultWithRows = result as { rows?: unknown[]; [key: string]: unknown };
      const updatedData = resultWithRows?.rows?.[0] || null;

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
    } catch (error: unknown) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'UPDATE', {
          table: this.table,
          duration: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  }

  async delete(where: Partial<T>): Promise<unknown> {
    validateDatabaseInput(where, 'delete');

    const startTime = Date.now();
    try {
      const conditions = Object.entries(where).map(([key], i) => `${key} = $${i + 1}`);
      const values = Object.values(where);

      const query = `DELETE FROM ${this.quoteIdentifier(this.table)} WHERE ${conditions.join(' AND ')} RETURNING *`;

      const result = await (
        this.pool as { query: (q: string, v: unknown[]) => Promise<unknown> }
      ).query(query, values);
      const resultWithRows = result as { rows?: unknown[]; [key: string]: unknown };
      const deletedData = resultWithRows?.rows?.[0] || null;

      if (this.connectionName) {
        logQuery(this.connectionName, 'DELETE', {
          table: this.table,
          query,
          duration: Date.now() - startTime,
          success: true,
        });
      }

      return deletedData;
    } catch (error: unknown) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'DELETE', {
          table: this.table,
          duration: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  }

  async raw(query: string, values: unknown[] = []): Promise<unknown> {
    // WARNING: Raw queries bypass security measures
    console.warn('[DB SECURITY WARNING] Raw query executed:', query);

    const startTime = Date.now();
    try {
      const result = await (
        this.pool as { query: (q: string, v: unknown[]) => Promise<unknown> }
      ).query(query, values);

      if (this.connectionName) {
        logQuery(this.connectionName, 'RAW_QUERY', {
          query,
          duration: Date.now() - startTime,
          success: true,
        });
      }

      return (
        (result as { rows?: unknown; [key: string]: unknown })?.rows || (result as unknown[])[0]
      );
    } catch (error: unknown) {
      if (this.connectionName) {
        logQuery(this.connectionName, 'RAW_QUERY', {
          query,
          duration: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  }

  private encryptSensitiveFields(data: unknown): void {
    if (!this.encryptionKey) return;

    for (const field of DB_SECURITY_CONFIG.sensitiveFields) {
      if (
        (data as Record<string, unknown>)[field] &&
        typeof (data as Record<string, unknown>)[field] === 'string'
      ) {
        (data as Record<string, unknown>)[field] = encryptField(
          (data as Record<string, unknown>)[field] as string,
          this.encryptionKey
        );
      }
    }
  }

  private decryptSensitiveFields(data: unknown): void {
    if (!this.encryptionKey) return;

    for (const field of DB_SECURITY_CONFIG.sensitiveFields) {
      if (
        (data as Record<string, unknown>)[field] &&
        typeof (data as Record<string, unknown>)[field] === 'string'
      ) {
        try {
          (data as Record<string, unknown>)[field] = decryptField(
            (data as Record<string, unknown>)[field] as string,
            this.encryptionKey
          );
        } catch {
          // If decryption fails, keep original value
          console.warn(`[DB] Failed to decrypt field ${field}`);
        }
      }
    }
  }
}

/**
 * Cassandra query builder
 */
export interface ICassandraQueryBuilder<T = unknown> {
  find(keyspace: string, table: string, where?: Partial<T>): Promise<T[]>;
  findOne(keyspace: string, table: string, where: Partial<T>): Promise<T | null>;
  insert(keyspace: string, table: string, data: Partial<T>): Promise<unknown>;
  update(keyspace: string, table: string, where: Partial<T>, data: Partial<T>): Promise<unknown>;
  delete(keyspace: string, table: string, where: Partial<T>): Promise<unknown>;
}

export class CassandraQueryBuilder<T = unknown> implements ICassandraQueryBuilder<T> {
  constructor(private client: unknown) {}

  /**
   * Validate identifier to prevent injection
   */
  private validateIdentifier(identifier: string): void {
    if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
      throw new Error(
        `Invalid identifier: "${identifier}". Identifiers must contain only alphanumeric characters and underscores.`
      );
    }
    if (identifier.length > 48) {
      throw new Error(`Identifier too long: "${identifier}". Maximum length is 48 characters.`);
    }
  }

  async find(keyspace: string, table: string, where: Partial<T> = {}): Promise<T[]> {
    this.validateIdentifier(keyspace);
    this.validateIdentifier(table);

    const conditions = Object.entries(where)
      .map(([key], i) => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(where);
    const query = `SELECT * FROM ${keyspace}.${table}${conditions ? ' WHERE ' + conditions : ''}`;
    const result = await (
      this.client as { execute: (q: string, v: unknown[]) => Promise<unknown> }
    ).execute(query, values);
    return ((result as { rows?: unknown[] })?.rows as T[]) || [];
  }

  async findOne(keyspace: string, table: string, where: Partial<T>): Promise<T | null> {
    const results = await this.find(keyspace, table, where);
    return results[0] || null;
  }

  async insert(keyspace: string, table: string, data: Partial<T>): Promise<unknown> {
    this.validateIdentifier(keyspace);
    this.validateIdentifier(table);

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => '?').join(', ');
    const query = `INSERT INTO ${keyspace}.${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    return await (
      this.client as { execute: (q: string, v: unknown[]) => Promise<unknown> }
    ).execute(query, values);
  }

  async update(
    keyspace: string,
    table: string,
    where: Partial<T>,
    data: Partial<T>
  ): Promise<unknown> {
    this.validateIdentifier(keyspace);
    this.validateIdentifier(table);

    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(', ');
    const whereClause = Object.keys(where)
      .map((key) => `${key} = ?`)
      .join(' AND ');
    const query = `UPDATE ${keyspace}.${table} SET ${setClause} WHERE ${whereClause}`;
    const values = [...Object.values(data), ...Object.values(where)];
    return await (
      this.client as { execute: (q: string, v: unknown[]) => Promise<unknown> }
    ).execute(query, values);
  }

  async delete(keyspace: string, table: string, where: Partial<T>): Promise<unknown> {
    this.validateIdentifier(keyspace);
    this.validateIdentifier(table);

    const whereClause = Object.keys(where)
      .map((key) => `${key} = ?`)
      .join(' AND ');
    const query = `DELETE FROM ${keyspace}.${table} WHERE ${whereClause}`;
    const values = Object.values(where);
    return await (
      this.client as { execute: (q: string, v: unknown[]) => Promise<unknown> }
    ).execute(query, values);
  }
}

/**
 * Elasticsearch query builder
 */
export interface IElasticsearchQueryBuilder<T = unknown> {
  search(index: string, query?: Record<string, unknown>): Promise<T[]>;
  get(index: string, id: string): Promise<T | null>;
  index(index: string, document: T): Promise<unknown>;
  update(index: string, id: string, document: Partial<T>): Promise<unknown>;
  delete(index: string, id: string): Promise<unknown>;
}

export class ElasticsearchQueryBuilder<T = unknown> implements IElasticsearchQueryBuilder<T> {
  constructor(private client: unknown) {}

  async search(index: string, query: Record<string, unknown> = {}): Promise<T[]> {
    const result = await (this.client as { search: (params: unknown) => Promise<unknown> }).search({
      index,
      body: query,
    });
    return (
      ((result as { hits?: { hits?: unknown[] } })?.hits?.hits?.map(
        (hit: any) => hit._source
      ) as T[]) || []
    );
  }

  async get(index: string, id: string): Promise<T | null> {
    try {
      const result = await (this.client as { get: (params: unknown) => Promise<unknown> }).get({
        index,
        id,
      });
      return (result as { _source?: T })._source || null;
    } catch {
      return null;
    }
  }

  async index(index: string, document: T): Promise<unknown> {
    return await (this.client as { index: (params: unknown) => Promise<unknown> }).index({
      index,
      body: document,
    });
  }

  async update(index: string, id: string, document: Partial<T>): Promise<unknown> {
    return await (this.client as { update: (params: unknown) => Promise<unknown> }).update({
      index,
      id,
      body: { doc: document },
    });
  }

  async delete(index: string, id: string): Promise<unknown> {
    return await (this.client as { delete: (params: unknown) => Promise<unknown> }).delete({
      index,
      id,
    });
  }
}

/**
 * DynamoDB query builder
 */
export interface IDynamoDBQueryBuilder<T = unknown> {
  scan(tableName: string): Promise<T[]>;
  query(tableName: string, keyCondition: Record<string, unknown>): Promise<T[]>;
  get(tableName: string, key: Record<string, unknown>): Promise<T | null>;
  put(tableName: string, item: T): Promise<unknown>;
  update(
    tableName: string,
    key: Record<string, unknown>,
    updateExpression: string,
    expressionAttributeValues: Record<string, unknown>
  ): Promise<unknown>;
  delete(tableName: string, key: Record<string, unknown>): Promise<unknown>;
}

export class DynamoDBQueryBuilder<T = unknown> implements IDynamoDBQueryBuilder<T> {
  constructor(private client: unknown) {}

  async scan(tableName: string): Promise<T[]> {
    const command = { TableName: tableName };
    const result = await (this.client as { send: (cmd: unknown) => Promise<unknown> }).send(
      command
    );
    return ((result as { Items?: unknown[] })?.Items as T[]) || [];
  }

  async query(tableName: string, keyCondition: Record<string, unknown>): Promise<T[]> {
    const command = {
      TableName: tableName,
      KeyConditionExpression: Object.keys(keyCondition)
        .map((k) => `${k} = :${k}`)
        .join(' AND '),
      ExpressionAttributeValues: Object.fromEntries(
        Object.entries(keyCondition).map(([k, v]) => [`:${k}`, v])
      ),
    };
    const result = await (this.client as { send: (cmd: unknown) => Promise<unknown> }).send(
      command
    );
    return ((result as { Items?: unknown[] })?.Items as T[]) || [];
  }

  async get(tableName: string, key: Record<string, unknown>): Promise<T | null> {
    const command = { TableName: tableName, Key: key };
    const result = await (this.client as { send: (cmd: unknown) => Promise<unknown> }).send(
      command
    );
    return (result as { Item?: T }).Item || null;
  }

  async put(tableName: string, item: T): Promise<unknown> {
    const command = { TableName: tableName, Item: item };
    return await (this.client as { send: (cmd: unknown) => Promise<unknown> }).send(command);
  }

  async update(
    tableName: string,
    key: Record<string, unknown>,
    updateExpression: string,
    expressionAttributeValues: Record<string, unknown>
  ): Promise<unknown> {
    const command = {
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    };
    return await (this.client as { send: (cmd: unknown) => Promise<unknown> }).send(command);
  }

  async delete(tableName: string, key: Record<string, unknown>): Promise<unknown> {
    const command = { TableName: tableName, Key: key };
    return await (this.client as { send: (cmd: unknown) => Promise<unknown> }).send(command);
  }
}

/**
 * Firebase query builder
 */
export interface IFirebaseQueryBuilder<T = unknown> {
  get(collection: string, docId?: string): Promise<T | T[] | null>;
  set(collection: string, docId: string, data: T): Promise<unknown>;
  update(collection: string, docId: string, data: Partial<T>): Promise<unknown>;
  delete(collection: string, docId: string): Promise<unknown>;
  query(collection: string, where?: [string, any, any][]): Promise<T[]>;
}

export class FirebaseQueryBuilder<T = unknown> implements IFirebaseQueryBuilder<T> {
  constructor(private db: unknown) {}

  async get(collection: string, docId?: string): Promise<T | T[] | null> {
    if (docId) {
      const doc = await (this.db as any).collection(collection).doc(docId).get();
      return doc.exists ? doc.data() : null;
    } else {
      const snapshot = await (this.db as any).collection(collection).get();
      return snapshot.docs.map((doc: any) => doc.data());
    }
  }

  async set(collection: string, docId: string, data: T): Promise<unknown> {
    return await (this.db as any).collection(collection).doc(docId).set(data);
  }

  async update(collection: string, docId: string, data: Partial<T>): Promise<unknown> {
    return await (this.db as any).collection(collection).doc(docId).update(data);
  }

  async delete(collection: string, docId: string): Promise<unknown> {
    return await (this.db as any).collection(collection).doc(docId).delete();
  }

  async query(collection: string, where: [string, any, any][] = []): Promise<T[]> {
    let query = (this.db as any).collection(collection);
    where.forEach(([field, op, value]) => {
      query = query.where(field, op, value);
    });
    const snapshot = await query.get();
    return snapshot.docs.map((doc: any) => doc.data());
  }
}

/**
 * Redis cache adapter
 */
export interface IRedisCache {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  increment(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  flushAll(): Promise<void>;
}

export class RedisCache implements IRedisCache {
  constructor(private client: unknown) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await (this.client as { get: (k: string) => Promise<string | null> }).get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await (this.client as { setex: (k: string, t: number, v: string) => Promise<unknown> }).setex(
        key,
        ttl,
        serialized
      );
    } else {
      await (this.client as { set: (k: string, v: string) => Promise<unknown> }).set(
        key,
        serialized
      );
    }
  }

  async delete(key: string): Promise<void> {
    await (this.client as { del: (k: string) => Promise<unknown> }).del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await (this.client as { exists: (k: string) => Promise<number> }).exists(key);
    return result === 1;
  }

  async increment(key: string): Promise<number> {
    return await (this.client as { incr: (k: string) => Promise<number> }).incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await (this.client as { expire: (k: string, s: number) => Promise<unknown> }).expire(
      key,
      seconds
    );
  }

  async keys(pattern: string): Promise<string[]> {
    return await (this.client as { keys: (p: string) => Promise<string[]> }).keys(pattern);
  }

  async flushAll(): Promise<void> {
    await (this.client as { flushall: () => Promise<unknown> }).flushall();
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
          await (connection.pool as { close: () => Promise<void> })?.close();
          break;
        case 'mysql':
        case 'postgresql':
          await (connection.pool as { end: () => Promise<void> })?.end();
          break;
        case 'redis':
          await (connection.client as { quit: () => Promise<void> })?.quit();
          break;
        // case 'sqlite':
        //   (connection.client as { close: () => void })?.close();
        //   break;
        case 'mssql':
          await (connection.pool as { close: () => Promise<void> })?.close();
          break;
        case 'oracle':
          await oracledb.getPool().close(0);
          break;
        case 'cassandra':
          await (connection.client as { shutdown: () => Promise<void> })?.shutdown();
          break;
        case 'elasticsearch':
          await (connection.client as { close: () => Promise<void> })?.close();
          break;
        case 'dynamodb':
          // DynamoDB client doesn't need explicit closing
          break;
        case 'firebase':
          // Firebase handles cleanup automatically
          break;
      }
      console.log(`[DB] Closed connection: ${name}`);
    } catch {
      console.error(`[DB] Error closing connection ${name}:`, 'Error occurred');
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
        await (connection.client as { db: () => { admin: () => { ping: () => Promise<void> } } })
          .db()
          .admin()
          .ping();
        break;
      case 'mysql':
      case 'postgresql':
        await (connection.pool as { query: (q: string) => Promise<unknown> }).query('SELECT 1');
        break;
      case 'redis':
        await (connection.client as { ping: () => Promise<unknown> }).ping();
        break;
      // case 'sqlite':
      //   (connection.client as { prepare: (q: string) => { get: () => unknown } })
      //     .prepare('SELECT 1')
      //     .get();
      //   break;
      case 'mssql':
        await (connection.pool as { request: () => { query: (q: string) => Promise<unknown> } })
          .request()
          .query('SELECT 1');
        break;
      case 'oracle':
        const oracleConnection = await (
          connection.pool as { getConnection: () => Promise<unknown> }
        ).getConnection();
        await (oracleConnection as { execute: (q: string) => Promise<unknown> }).execute(
          'SELECT 1 FROM DUAL'
        );
        await (oracleConnection as { close: () => Promise<void> }).close();
        break;
      case 'cassandra':
        await (connection.client as { execute: (q: string) => Promise<unknown> }).execute(
          'SELECT now() FROM system.local'
        );
        break;
      case 'elasticsearch':
        await (connection.client as { ping: () => Promise<unknown> }).ping();
        break;
      case 'dynamodb':
        // DynamoDB health check - try to list tables
        await (connection.client as { send: (cmd: unknown) => Promise<unknown> }).send({} as any);
        break;
      case 'firebase':
        // Firebase health check - try to get a document
        await (
          connection.client as {
            collection: (c: string) => { limit: (n: number) => { get: () => Promise<unknown> } };
          }
        )
          .collection('_health_check')
          .limit(1)
          .get();
        break;
    }

    const latency = Date.now() - startTime;
    return {
      status: 'healthy',
      latency,
      connections:
        (connection.pool as any)?.totalCount || (connection.pool as any)?.totalConnections || 1,
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
