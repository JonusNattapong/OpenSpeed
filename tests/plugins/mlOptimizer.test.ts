import { describe, it, expect, beforeEach, vi } from 'vitest';
import mlOptimizer from '../../src/openspeed/plugins/mlOptimizer.js';
import Context from '../../src/openspeed/context.js';

describe('ML Optimizer Plugin', () => {
  let mockNext: any;

  beforeEach(() => {
    mockNext = vi.fn(async () => {});
  });

  describe('Performance Prediction', () => {
    it('should predict request performance', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          performancePrediction: true,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/users',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(ctx.res.headers?.['x-ml-prediction-confidence']).toBeDefined();
    });

    it('should apply predictive caching', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        predictionThreshold: 0.7,
        features: {
          performancePrediction: true,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/popular',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(ctx.optimizationApplied).toBeDefined();
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect latency anomalies', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          anomalyDetection: true,
        },
        optimization: {
          targetLatency: 100,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/slow',
        headers: {},
      });

      // Simulate slow response
      mockNext = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      await middleware(ctx, mockNext);

      expect(ctx.res.headers?.['x-anomaly-score']).toBeDefined();
    });

    it('should detect memory anomalies', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          anomalyDetection: true,
        },
        optimization: {
          maxMemory: 100, // 100MB
        },
      });

      const ctx = new Context({
        method: 'POST',
        url: 'http://localhost:3000/api/upload',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should trigger auto-healing on critical anomalies', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          anomalyDetection: true,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/error',
        headers: {},
      });

      // Simulate error response
      mockNext = vi.fn(async () => {
        ctx.res.status = 500;
      });

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Resource Allocation', () => {
    it('should allocate resources based on request priority', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          resourceAllocation: true,
        },
      });

      const ctx = new Context({
        method: 'POST',
        url: 'http://localhost:3000/api/process',
        headers: {
          'x-priority': 'high',
        },
      });

      await middleware(ctx, mockNext);

      expect(ctx.resourceAllocation).toBeDefined();
      expect(ctx.resourceAllocation.memory).toBeGreaterThan(0);
    });

    it('should adapt allocation based on system load', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          resourceAllocation: true,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/data',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(ctx.resourceAllocation).toBeDefined();
    });
  });

  describe('Query Optimization', () => {
    it('should learn from query patterns', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          queryOptimization: true,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/users',
        headers: {},
      });

      ctx.queryExecutions = [
        {
          query: 'SELECT * FROM users WHERE id = 1',
          duration: 150,
        },
      ];

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Load Balancing', () => {
    it('should track endpoint metrics', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          loadBalancing: true,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/endpoint',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should calculate health scores', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          loadBalancing: true,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/health',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(ctx.res.status).toBeDefined();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect request metrics', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        metrics: {
          collectInterval: 1000,
          retentionPeriod: 24,
        },
      });

      const ctx = new Context({
        method: 'POST',
        url: 'http://localhost:3000/api/data',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(ctx.res.headers?.['x-ml-prediction-confidence']).toBeDefined();
    });

    it('should retain metrics within specified period', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        metrics: {
          retentionPeriod: 1, // 1 hour
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/test',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Training Scheduler', () => {
    it('should schedule periodic training', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        trainingInterval: 1, // 1 minute
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/train',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle disabled optimizer', async () => {
      const middleware = mlOptimizer({
        enabled: false,
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/test',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(ctx.optimizationApplied).toBeUndefined();
    });

    it('should handle requests with no historical data', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          performancePrediction: true,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/new-endpoint',
        headers: {},
      });

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const middleware = mlOptimizer({
        enabled: true,
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/error',
        headers: {},
      });

      mockNext = vi.fn(async () => {
        throw new Error('Test error');
      });

      await expect(middleware(ctx, mockNext)).rejects.toThrow('Test error');
    });

    it('should handle array priority headers', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        features: {
          resourceAllocation: true,
        },
      });

      const ctx = new Context({
        method: 'GET',
        url: 'http://localhost:3000/api/test',
        headers: {
          'x-priority': ['high', 'critical'],
        },
      });

      await middleware(ctx, mockNext);

      expect(ctx.resourceAllocation).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should work with all features enabled', async () => {
      const middleware = mlOptimizer({
        enabled: true,
        trainingInterval: 30,
        predictionThreshold: 0.7,
        features: {
          performancePrediction: true,
          resourceAllocation: true,
          anomalyDetection: true,
          queryOptimization: true,
          loadBalancing: true,
          autoScaling: true,
        },
        metrics: {
          collectInterval: 1000,
          retentionPeriod: 24,
        },
        optimization: {
          targetLatency: 100,
          maxMemory: 512,
          cpuThreshold: 80,
          throughputTarget: 1000,
        },
      });

      const ctx = new Context({
        method: 'POST',
        url: 'http://localhost:3000/api/complex',
        headers: {
          'x-priority': 'high',
        },
      });

      ctx.queryExecutions = [
        {
          query: 'SELECT * FROM users',
          duration: 50,
        },
      ];

      await middleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(ctx.res.headers?.['x-ml-prediction-confidence']).toBeDefined();
      expect(ctx.res.headers?.['x-optimization-applied']).toBeDefined();
      expect(ctx.res.headers?.['x-anomaly-score']).toBeDefined();
    });
  });
});
