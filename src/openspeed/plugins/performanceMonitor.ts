import type { Context } from '../context.js';

interface PerformanceMetrics {
  method: string;
  path: string;
  responseTime: number;
  statusCode: number;
  timestamp: number;
  memoryUsage?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  requestSize?: number;
  responseSize?: number;
}

interface PerformanceMonitorOptions {
  enabled?: boolean;
  endpoint?: string;
  slowThreshold?: number; // ms
  maxEntries?: number;
  includeMemory?: boolean;
  includeSizes?: boolean;
  logSlowRequests?: boolean;
}

/**
 * Performance monitor for development - tracks API response times and bottlenecks
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  public options: Required<PerformanceMonitorOptions>;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.options = {
      enabled: process.env.NODE_ENV === 'development',
      endpoint: '/_performance',
      slowThreshold: 1000, // 1 second
      maxEntries: 1000,
      includeMemory: true,
      includeSizes: true,
      logSlowRequests: true,
      ...options
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);

    // Keep only the most recent entries
    if (this.metrics.length > this.options.maxEntries) {
      this.metrics = this.metrics.slice(-this.options.maxEntries);
    }

    // Log slow requests
    if (this.options.logSlowRequests && metric.responseTime > this.options.slowThreshold) {
      console.warn(`🐌 Slow request: ${metric.method} ${metric.path} took ${metric.responseTime}ms`);
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get performance statistics
   */
  getStats() {
    if (this.metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowestRequest: 0,
        fastestRequest: 0,
        requestsPerSecond: 0,
        errorRate: 0,
        slowRequests: 0
      };
    }

    const responseTimes = this.metrics.map(m => m.responseTime);
    const errorCodes = this.metrics.filter(m => m.statusCode >= 400).length;
    const slowRequests = this.metrics.filter(m => m.responseTime > this.options.slowThreshold).length;

    const totalTime = this.metrics[this.metrics.length - 1]?.timestamp - this.metrics[0]?.timestamp || 1;
    const requestsPerSecond = (this.metrics.length / totalTime) * 1000;

    return {
      totalRequests: this.metrics.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      slowestRequest: Math.max(...responseTimes),
      fastestRequest: Math.min(...responseTimes),
      requestsPerSecond: requestsPerSecond,
      errorRate: (errorCodes / this.metrics.length) * 100,
      slowRequests: slowRequests
    };
  }

  /**
   * Get metrics grouped by endpoint
   */
  getMetricsByEndpoint(): Record<string, PerformanceMetrics[]> {
    const grouped: Record<string, PerformanceMetrics[]> = {};

    for (const metric of this.metrics) {
      const key = `${metric.method} ${metric.path}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(metric);
    }

    return grouped;
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = [];
  }

  /**
   * Generate HTML performance dashboard
   */
  generateHTML(): string {
    const stats = this.getStats();
    const endpointMetrics = this.getMetricsByEndpoint();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenSpeed Performance Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa; color: #333; line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white; padding: 30px; text-align: center;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .stat-number { font-size: 2rem; font-weight: bold; color: #f5576c; }
        .stat-label { color: #666; margin-top: 5px; font-size: 0.9rem; }
        .stat.warning .stat-number { color: #f59e0b; }
        .stat.error .stat-number { color: #ef4444; }
        .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .chart { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .chart h3 { margin-bottom: 15px; color: #333; }
        .endpoints { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .endpoint { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 15px; }
        .endpoint:last-child { border-bottom: none; }
        .endpoint-method { padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; min-width: 70px; text-align: center; }
        .endpoint-method.GET { background: #10b981; color: white; }
        .endpoint-method.POST { background: #f59e0b; color: white; }
        .endpoint-method.PUT { background: #3b82f6; color: white; }
        .endpoint-method.DELETE { background: #ef4444; color: white; }
        .endpoint-path { flex: 1; font-family: 'Monaco', monospace; }
        .endpoint-metrics { display: flex; gap: 15px; font-size: 0.9rem; }
        .metric { color: #666; }
        .metric.slow { color: #ef4444; font-weight: bold; }
        .metric.fast { color: #10b981; font-weight: bold; }
        .no-data { text-align: center; padding: 40px; color: #666; }
        .actions { display: flex; gap: 10px; margin-bottom: 20px; }
        .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
        .btn.primary { background: #f5576c; color: white; }
        .btn.secondary { background: #6b7280; color: white; }
        .refresh { position: fixed; bottom: 20px; right: 20px; background: #f5576c; color: white;
                   padding: 12px 20px; border-radius: 50px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                   transition: all 0.3s; }
        .refresh:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚡ OpenSpeed Performance Monitor</h1>
        <p>Track your API performance and identify bottlenecks</p>
    </div>

    <div class="container">
        <div class="actions">
            <button class="btn primary" onclick="clearMetrics()">🗑️ Clear Metrics</button>
            <button class="btn secondary" onclick="exportMetrics()">📊 Export Data</button>
        </div>

        <div class="stats-grid">
            <div class="stat">
                <div class="stat-number">${stats.totalRequests}</div>
                <div class="stat-label">Total Requests</div>
            </div>
            <div class="stat">
                <div class="stat-number">${stats.averageResponseTime.toFixed(0)}ms</div>
                <div class="stat-label">Avg Response Time</div>
            </div>
            <div class="stat ${stats.slowestRequest > this.options.slowThreshold ? 'warning' : ''}">
                <div class="stat-number">${stats.slowestRequest.toFixed(0)}ms</div>
                <div class="stat-label">Slowest Request</div>
            </div>
            <div class="stat">
                <div class="stat-number">${stats.requestsPerSecond.toFixed(1)}</div>
                <div class="stat-label">Requests/sec</div>
            </div>
            <div class="stat ${stats.errorRate > 5 ? 'error' : ''}">
                <div class="stat-number">${stats.errorRate.toFixed(1)}%</div>
                <div class="stat-label">Error Rate</div>
            </div>
            <div class="stat ${stats.slowRequests > 0 ? 'warning' : ''}">
                <div class="stat-number">${stats.slowRequests}</div>
                <div class="stat-label">Slow Requests</div>
            </div>
        </div>

        <div class="charts">
            <div class="chart">
                <h3>Response Time Distribution</h3>
                <canvas id="responseTimeChart" width="400" height="200"></canvas>
            </div>
            <div class="chart">
                <h3>Status Code Distribution</h3>
                <canvas id="statusCodeChart" width="400" height="200"></canvas>
            </div>
        </div>

        <div class="endpoints">
            <div style="background: #f1f5f9; padding: 15px 20px; font-weight: bold; border-bottom: 2px solid #e2e8f0;">
                📊 Endpoint Performance
            </div>
            ${Object.entries(endpointMetrics).map(([endpoint, metrics]) => {
              const avgTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
              const [method, path] = endpoint.split(' ');
              const isSlow = avgTime > this.options.slowThreshold;

              return `
                <div class="endpoint">
                  <span class="endpoint-method ${method}">${method}</span>
                  <span class="endpoint-path">${path}</span>
                  <div class="endpoint-metrics">
                    <span class="metric">Avg: ${avgTime.toFixed(0)}ms</span>
                    <span class="metric">Count: ${metrics.length}</span>
                    <span class="metric ${isSlow ? 'slow' : 'fast'}">
                      ${isSlow ? '🐌 Slow' : '⚡ Fast'}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}

            ${this.metrics.length === 0 ? '<div class="no-data">No performance data yet. Make some API requests! 🚀</div>' : ''}
        </div>
    </div>

    <a href="${this.options.endpoint}" class="refresh" onclick="window.location.reload()">🔄 Refresh</a>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        // Response time chart
        const responseTimes = ${JSON.stringify(this.metrics.map(m => m.responseTime))};
        const ctx1 = document.getElementById('responseTimeChart').getContext('2d');
        new Chart(ctx1, {
            type: 'line',
            data: {
                labels: responseTimes.map((_, i) => i + 1),
                datasets: [{
                    label: 'Response Time (ms)',
                    data: responseTimes,
                    borderColor: '#f5576c',
                    backgroundColor: 'rgba(245, 87, 108, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Status code chart
        const statusCodes = ${JSON.stringify(this.metrics.reduce((acc, m) => {
          acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
          return acc;
        }, {} as Record<number, number>))};
        const ctx2 = document.getElementById('statusCodeChart').getContext('2d');
        new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCodes),
                datasets: [{
                    data: Object.values(statusCodes),
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']
                }]
            },
            options: {
                responsive: true
            }
        });

        function clearMetrics() {
            fetch('${this.options.endpoint}/clear', { method: 'POST' })
                .then(() => window.location.reload());
        }

        function exportMetrics() {
            const data = ${JSON.stringify(this.metrics)};
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'performance-metrics.json';
            a.click();
            URL.revokeObjectURL(url);
        }

        // Auto-refresh every 10 seconds in development
        if (${this.options.enabled}) {
            setTimeout(() => window.location.reload(), 10000);
        }
    </script>
</body>
</html>`;
  }

  /**
   * Generate ASCII performance report
   */
  generateASCII(): string {
    const stats = this.getStats();

    if (this.metrics.length === 0) {
      return 'No performance data available.';
    }

    let output = '\n⚡ OpenSpeed Performance Report\n';
    output += '='.repeat(60) + '\n';
    output += `Total Requests:     ${stats.totalRequests}\n`;
    output += `Average Response:    ${stats.averageResponseTime.toFixed(2)}ms\n`;
    output += `Slowest Request:     ${stats.slowestRequest.toFixed(2)}ms\n`;
    output += `Fastest Request:     ${stats.fastestRequest.toFixed(2)}ms\n`;
    output += `Requests/sec:        ${stats.requestsPerSecond.toFixed(2)}\n`;
    output += `Error Rate:          ${stats.errorRate.toFixed(2)}%\n`;
    output += `Slow Requests:       ${stats.slowRequests}\n`;
    output += '='.repeat(60) + '\n';

    return output;
  }
}

// Global performance monitor instance
let globalMonitor: PerformanceMonitor | null = null;

/**
 * Performance monitoring middleware
 */
export function performanceMonitor(options: PerformanceMonitorOptions = {}) {
  const monitor = new PerformanceMonitor(options);
  globalMonitor = monitor;

  return async (ctx: Context, next: () => Promise<void>) => {
    const startTime = Date.now();

    // Handle performance dashboard endpoint
    if (ctx.req.url === monitor.options.endpoint) {
      ctx.res.headers = ctx.res.headers || {};
      ctx.res.headers['content-type'] = 'text/html';
      ctx.res.body = monitor.generateHTML();
      return;
    }

    // Handle clear metrics endpoint
    if (ctx.req.url === `${monitor.options.endpoint}/clear` && ctx.req.method === 'POST') {
      monitor.clearMetrics();
      ctx.res.status = 200;
      ctx.res.body = { success: true };
      return;
    }

    try {
      await next();

      const responseTime = Date.now() - startTime;
      const metric: PerformanceMetrics = {
        method: ctx.req.method,
        path: ctx.req.url,
        responseTime,
        statusCode: ctx.res.status || 200,
        timestamp: Date.now()
      };

      if (monitor.options.includeMemory) {
        metric.memoryUsage = process.memoryUsage();
      }

      if (monitor.options.includeSizes) {
        metric.requestSize = JSON.stringify(ctx.req.body || {}).length;
        metric.responseSize = JSON.stringify(ctx.res.body || {}).length;
      }

      monitor.recordMetric(metric);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      monitor.recordMetric({
        method: ctx.req.method,
        path: ctx.req.url,
        responseTime,
        statusCode: 500,
        timestamp: Date.now()
      });
      throw error;
    }
  };
}

/**
 * Get the global performance monitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor | null {
  return globalMonitor;
}

/**
 * Print performance report to console
 */
export function printPerformanceReport() {
  if (globalMonitor) {
    console.log(globalMonitor.generateASCII());
  }
}