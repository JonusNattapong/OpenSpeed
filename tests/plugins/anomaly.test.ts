import { describe, it, expect, vi } from 'vitest';
import { anomalyPlugin } from '../../src/openspeed/plugins/anomaly.js';
import Context from '../../src/openspeed/context.js';

// Mock fetch for webhook alerts
global.fetch = vi.fn();

describe('Anomaly Detection Plugin', () => {
  it('should detect normal data points', async () => {
    const plugin = anomalyPlugin({
      windowSize: 60, // 1 minute
      threshold: 3,
      alertInterval: 1000,
    });

    const ctx = new Context({ url: '/', method: 'GET', headers: {} });
    const next = vi.fn();

    await plugin(ctx, next);

    // Add normal data points
    for (let i = 0; i < 20; i++) {
      const isAnomaly = ctx.anomaly.detect('response_time', 100 + Math.random() * 10);
      expect(isAnomaly).toBe(false); // Should not detect anomalies in normal data
    }

    expect(next).toHaveBeenCalled();
  });

  it('should detect anomalies in data', async () => {
    const plugin = anomalyPlugin({
      windowSize: 60,
      threshold: 2, // Lower threshold for easier detection
      alertInterval: 1000,
    });

    const ctx = new Context({ url: '/', method: 'GET', headers: {} });
    const next = vi.fn();

    await plugin(ctx, next);

    // Add normal data points
    for (let i = 0; i < 15; i++) {
      ctx.anomaly.detect('response_time', 100 + Math.random() * 5);
    }

    // Add anomaly
    const isAnomaly = ctx.anomaly.detect('response_time', 1000); // Much higher value
    expect(isAnomaly).toBe(true);
  });

  it('should provide statistics', async () => {
    const plugin = anomalyPlugin();

    const ctx = new Context({ url: '/', method: 'GET', headers: {} });
    const next = vi.fn();

    await plugin(ctx, next);

    // Add some data points
    for (let i = 0; i < 10; i++) {
      ctx.anomaly.detect('cpu_usage', 50 + Math.random() * 20);
    }

    const stats = ctx.anomaly.getStats('cpu_usage');
    expect(stats).toBeTruthy();
    expect(stats.count).toBe(10);
    expect(stats.mean).toBeGreaterThan(40);
    expect(stats.mean).toBeLessThan(80);
  });

  it('should handle anomaly stats endpoint', async () => {
    const plugin = anomalyPlugin();

    const ctx = new Context({ url: '/anomaly/stats', method: 'GET', headers: {} });
    ctx.res = { status: 200, headers: {}, body: undefined };

    await plugin(ctx, () => Promise.resolve());

    expect(ctx.res.body).toBeTruthy();
    expect(ctx.res.body.metrics).toBeDefined();
    expect(ctx.res.body.config).toBeDefined();
  });

  it('should send webhook alerts', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const plugin = anomalyPlugin({
      windowSize: 60,
      threshold: 2,
      alertWebhook: 'https://example.com/webhook',
      alertInterval: 100,
    });

    const ctx = new Context({ url: '/', method: 'GET', headers: {} });
    const next = vi.fn();

    await plugin(ctx, next);

    // Add normal data
    for (let i = 0; i < 10; i++) {
      ctx.anomaly.detect('memory_usage', 100 + Math.random() * 10);
    }

    // Add anomaly
    ctx.anomaly.detect('memory_usage', 1000);

    // Wait for alert
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
});
