import { describe, it, expect } from 'vitest';
import { adaptiveOptimizer, BloomFilter, ObjectPool } from '../../dist/src/openspeed/plugins/adaptiveOptimizer.js';

describe('Adaptive Optimizer Plugin', () => {
  it('should create adaptive optimizer plugin', () => {
    const plugin = adaptiveOptimizer({
      enableBatching: true,
      enableCaching: true,
      enablePrefetching: true,
    });

    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('function');
  });

  it('should support ML-based optimization', () => {
    const plugin = adaptiveOptimizer({
      ml: {
        enabled: true,
      },
    });

    expect(plugin).toBeDefined();
  });

  describe('BloomFilter', () => {
    it('should add and test values', () => {
      const filter = new BloomFilter(1000);
      filter.add('/api/users');
      filter.add('/api/posts');

      expect(filter.test('/api/users')).toBe(true);
      expect(filter.test('/api/posts')).toBe(true);
      expect(filter.test('/api/unknown')).toBe(false);
    });

    it('should handle collisions', () => {
      const filter = new BloomFilter(10); // Small size for testing
      filter.add('test1');
      filter.add('test2');

      // Should still work but may have false positives
      expect(filter.test('test1')).toBe(true);
      expect(filter.test('test2')).toBe(true);
    });
  });

  describe('ObjectPool', () => {
    it('should acquire and release objects', () => {
      const pool = new ObjectPool(
        () => ({ data: null }),
        (obj) => {
          obj.data = null;
        }
      );

      const obj1 = pool.acquire();
      expect(obj1).toBeDefined();

      obj1.data = 'test';
      pool.release(obj1);

      const obj2 = pool.acquire();
      expect(obj2.data).toBeNull(); // Should be reset
    });

    it('should respect max size', () => {
      const pool = new ObjectPool(
        () => ({}),
        () => {},
        2
      );

      const objs = [pool.acquire(), pool.acquire(), pool.acquire()];
      objs.forEach((obj) => pool.release(obj));

      expect(pool.size()).toBe(2); // Max size is 2
    });
  });
});
