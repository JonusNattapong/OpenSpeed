import { describe, it, expect, vi } from 'vitest';
import {
  database,
  MongoQueryBuilder,
  SQLQueryBuilder,
  RedisCache,
  CassandraQueryBuilder,
} from '../../dist/src/openspeed/plugins/database.js';

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

describe('CassandraQueryBuilder', () => {
  let mockClient: any;
  let builder: CassandraQueryBuilder;

  beforeEach(() => {
    mockClient = {
      execute: vi.fn(),
    };
    builder = new CassandraQueryBuilder(mockClient);
  });

  describe('validateIdentifier', () => {
    it('should accept valid identifiers', () => {
      expect(() => (builder as any).validateIdentifier('valid_table')).not.toThrow();
      expect(() => (builder as any).validateIdentifier('table123')).not.toThrow();
      expect(() => (builder as any).validateIdentifier('my_table_name')).not.toThrow();
    });

    it('should reject invalid identifiers with special characters', () => {
      expect(() => (builder as any).validateIdentifier('table-name')).toThrow('Invalid identifier');
      expect(() => (builder as any).validateIdentifier('table.name')).toThrow('Invalid identifier');
      expect(() => (builder as any).validateIdentifier('table name')).toThrow('Invalid identifier');
      expect(() => (builder as any).validateIdentifier('table;name')).toThrow('Invalid identifier');
    });

    it('should reject identifiers that are too long', () => {
      const longIdentifier = 'a'.repeat(49);
      expect(() => (builder as any).validateIdentifier(longIdentifier)).toThrow(
        'Identifier too long'
      );
    });
  });

  describe('quoteIdentifier', () => {
    it('should quote valid identifiers', () => {
      expect((builder as any).quoteIdentifier('table')).toBe('"table"');
      expect((builder as any).quoteIdentifier('my_keyspace')).toBe('"my_keyspace"');
    });

    it('should throw on invalid identifiers', () => {
      expect(() => (builder as any).quoteIdentifier('invalid-table')).toThrow();
    });
  });

  describe('find', () => {
    it('should build correct query with where conditions', async () => {
      mockClient.execute.mockResolvedValue({ rows: [{ id: 1, name: 'test' }] });

      const result = await builder.find('keyspace', 'table', { id: 1, name: 'test' });

      expect(mockClient.execute).toHaveBeenCalledWith(
        'SELECT * FROM "keyspace"."table" WHERE "id" = ? AND "name" = ?',
        [1, 'test']
      );
      expect(result).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should build query without where conditions', async () => {
      mockClient.execute.mockResolvedValue({ rows: [] });

      await builder.find('keyspace', 'table');

      expect(mockClient.execute).toHaveBeenCalledWith('SELECT * FROM "keyspace"."table"', []);
    });

    it('should prevent injection through identifier validation', async () => {
      await expect(builder.find('keyspace; DROP TABLE users;', 'table')).rejects.toThrow(
        'Invalid identifier'
      );
    });
  });

  describe('findOne', () => {
    it('should return first result or null', async () => {
      mockClient.execute.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await builder.findOne('keyspace', 'table', { id: 1 });

      expect(result).toEqual({ id: 1 });
    });

    it('should return null if no results', async () => {
      mockClient.execute.mockResolvedValue({ rows: [] });

      const result = await builder.findOne('keyspace', 'table', { id: 1 });

      expect(result).toBeNull();
    });
  });

  describe('insert', () => {
    it('should build correct insert query', async () => {
      mockClient.execute.mockResolvedValue({});

      await builder.insert('keyspace', 'table', { id: 1, name: 'test' });

      expect(mockClient.execute).toHaveBeenCalledWith(
        'INSERT INTO "keyspace"."table" ("id", "name") VALUES (?, ?)',
        [1, 'test']
      );
    });

    it('should prevent injection in column names', async () => {
      await expect(
        builder.insert('keyspace', 'table', { 'id; DROP TABLE users;': 1 })
      ).rejects.toThrow('Invalid identifier');
    });
  });

  describe('update', () => {
    it('should build correct update query', async () => {
      mockClient.execute.mockResolvedValue({});

      await builder.update('keyspace', 'table', { id: 1 }, { name: 'updated' });

      expect(mockClient.execute).toHaveBeenCalledWith(
        'UPDATE "keyspace"."table" SET "name" = ? WHERE "id" = ?',
        ['updated', 1]
      );
    });
  });

  describe('delete', () => {
    it('should build correct delete query', async () => {
      mockClient.execute.mockResolvedValue({});

      await builder.delete('keyspace', 'table', { id: 1 });

      expect(mockClient.execute).toHaveBeenCalledWith(
        'DELETE FROM "keyspace"."table" WHERE "id" = ?',
        [1]
      );
    });
  });
});
