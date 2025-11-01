import { describe, it, expect } from 'vitest';
import { database, MongoQueryBuilder, SQLQueryBuilder, RedisCache } from '../../dist/src/openspeed/plugins/database.js';

describe('Database Plugin', () => {
  it('should create database plugin', () => {
    const dbPlugin = database('test', {
      type: 'mongodb',
      connection: 'mongodb://localhost:27017/test',
    });

    expect(dbPlugin).toBeDefined();
    expect(typeof dbPlugin).toBe('function');
  });

  it('should support multi-tenancy', () => {
    const dbPlugin = database('test', {
      type: 'mongodb',
      connection: 'mongodb://localhost:27017/test',
      multiTenant: true,
      tenantKey: 'x-tenant-id',
    });

    expect(dbPlugin).toBeDefined();
  });

  it('should create MongoQueryBuilder', () => {
    // This would require a real MongoDB instance
    // For now, test that the class exists
    expect(MongoQueryBuilder).toBeDefined();
  });

  it('should create SQLQueryBuilder', () => {
    expect(SQLQueryBuilder).toBeDefined();
  });

  it('should create RedisCache', () => {
    expect(RedisCache).toBeDefined();
  });
});
