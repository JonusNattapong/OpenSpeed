import { register, collectDefaultMetrics, Gauge, Counter, Histogram, Summary } from 'prom-client';
import type { Context } from '../context.js';

export interface MetricsOptions {
  prefix?: string;
  collectDefaultMetrics?: boolean;
  customMetrics?: {
    name: string;
    type: 'counter' | 'gauge' | 'histogram' | 'summary';
    description: string;
    labels?: string[];
  }[];
}

export class MetricsManager {
  private prefix: string;
  private metrics: Map<string, any> = new Map();

  constructor(options: MetricsOptions = {}) {
    this.prefix = options.prefix || 'openspeed_';

    if (options.collectDefaultMetrics !== false) {
      collectDefaultMetrics({ prefix: this.prefix });
    }

    // Initialize custom metrics
    if (options.customMetrics) {
      for (const metric of options.customMetrics) {
        this.createMetric(metric);
      }
    }

    // Initialize default business metrics
    this.initializeDefaultMetrics();
  }

  private createMetric(config: { name: string; type: string; description: string; labels?: string[] }) {
    const fullName = this.prefix + config.name;
    const labels = config.labels || [];

    switch (config.type) {
      case 'counter':
        this.metrics.set(config.name, new Counter({
          name: fullName,
          help: config.description,
          labelNames: labels
        }));
        break;
      case 'gauge':
        this.metrics.set(config.name, new Gauge({
          name: fullName,
          help: config.description,
          labelNames: labels
        }));
        break;
      case 'histogram':
        this.metrics.set(config.name, new Histogram({
          name: fullName,
          help: config.description,
          labelNames: labels
        }));
        break;
      case 'summary':
        this.metrics.set(config.name, new Summary({
          name: fullName,
          help: config.description,
          labelNames: labels
        }));
        break;
    }
  }

  private initializeDefaultMetrics() {
    // HTTP request metrics
    this.createMetric({
      name: 'http_requests_total',
      type: 'counter',
      description: 'Total number of HTTP requests',
      labels: ['method', 'route', 'status']
    });

    this.createMetric({
      name: 'http_request_duration_seconds',
      type: 'histogram',
      description: 'HTTP request duration in seconds',
      labels: ['method', 'route']
    });

    // Business KPIs
    this.createMetric({
      name: 'active_users',
      type: 'gauge',
      description: 'Number of active users'
    });

    this.createMetric({
      name: 'orders_total',
      type: 'counter',
      description: 'Total number of orders',
      labels: ['status']
    });

    this.createMetric({
      name: 'revenue_total',
      type: 'counter',
      description: 'Total revenue in cents'
    });

    // System metrics
    this.createMetric({
      name: 'database_connections_active',
      type: 'gauge',
      description: 'Number of active database connections'
    });

    this.createMetric({
      name: 'cache_hit_ratio',
      type: 'gauge',
      description: 'Cache hit ratio (0-1)'
    });
  }

  getMetric(name: string): any {
    return this.metrics.get(name);
  }

  incrementCounter(name: string, labels?: Record<string, string>, value: number = 1) {
    const metric = this.getMetric(name);
    if (metric && metric instanceof Counter) {
      metric.inc(labels || {}, value);
    }
  }

  setGauge(name: string, value: number, labels?: Record<string, string>) {
    const metric = this.getMetric(name);
    if (metric && metric instanceof Gauge) {
      metric.set(labels || {}, value);
    }
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>) {
    const metric = this.getMetric(name);
    if (metric && metric instanceof Histogram) {
      metric.observe(labels || {}, value);
    }
  }

  observeSummary(name: string, value: number, labels?: Record<string, string>) {
    const metric = this.getMetric(name);
    if (metric && metric instanceof Summary) {
      metric.observe(labels || {}, value);
    }
  }

  // Business KPI methods
  recordHttpRequest(method: string, route: string, status: number, duration: number) {
    this.incrementCounter('http_requests_total', { method, route, status: status.toString() });
    this.observeHistogram('http_request_duration_seconds', duration / 1000, { method, route });
  }

  setActiveUsers(count: number) {
    this.setGauge('active_users', count);
  }

  recordOrder(status: string = 'completed') {
    this.incrementCounter('orders_total', { status });
  }

  recordRevenue(amountInCents: number) {
    this.incrementCounter('revenue_total', {}, amountInCents);
  }

  setDatabaseConnections(count: number) {
    this.setGauge('database_connections_active', count);
  }

  setCacheHitRatio(ratio: number) {
    this.setGauge('cache_hit_ratio', ratio);
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  reset() {
    // Reset all metrics (useful for testing)
    register.resetMetrics();
    this.metrics.clear();
  }
}

export function metricsPlugin(options: MetricsOptions = {}) {
  const metricsManager = new MetricsManager(options);

  return async (ctx: Context, next: () => Promise<any>) => {
    const startTime = Date.now();

    // Add metrics to context
    ctx.metrics = {
      manager: metricsManager,
      incrementCounter: (name: string, labels?: Record<string, string>, value?: number) =>
        metricsManager.incrementCounter(name, labels, value),
      setGauge: (name: string, value: number, labels?: Record<string, string>) =>
        metricsManager.setGauge(name, value, labels),
      observeHistogram: (name: string, value: number, labels?: Record<string, string>) =>
        metricsManager.observeHistogram(name, value, labels),
      observeSummary: (name: string, value: number, labels?: Record<string, string>) =>
        metricsManager.observeSummary(name, value, labels),
      // Business KPI helpers
      recordHttpRequest: (method: string, route: string, status: number, duration: number) =>
        metricsManager.recordHttpRequest(method, route, status, duration),
      setActiveUsers: (count: number) => metricsManager.setActiveUsers(count),
      recordOrder: (status?: string) => metricsManager.recordOrder(status),
      recordRevenue: (amount: number) => metricsManager.recordRevenue(amount),
      setDatabaseConnections: (count: number) => metricsManager.setDatabaseConnections(count),
      setCacheHitRatio: (ratio: number) => metricsManager.setCacheHitRatio(ratio),
      getMetrics: () => metricsManager.getMetrics()
    };

    try {
      await next();

      // Record HTTP request metrics
      const duration = Date.now() - startTime;
      const method = ctx.req.method;
      const route = ctx.req.url.split('?')[0]; // Remove query params
      const status = ctx.res.status || 200;

      metricsManager.recordHttpRequest(method, route, status, duration);
    } catch (error) {
      // Record error metrics
      const duration = Date.now() - startTime;
      const method = ctx.req.method;
      const route = ctx.req.url.split('?')[0];
      const status = ctx.res.status || 500;

      metricsManager.recordHttpRequest(method, route, status, duration);
      throw error;
    }
  };
}