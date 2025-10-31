import type { Context } from '../context.js';

export interface DashboardOptions {
  metricsEndpoint?: string;
  healthEndpoint?: string;
  enableWebSocket?: boolean;
  updateInterval?: number;
}

export function dashboardPlugin(options: DashboardOptions = {}) {
  const {
    metricsEndpoint = '/metrics',
    healthEndpoint = '/health',
    enableWebSocket = true,
    updateInterval = 5000
  } = options;

  return async (ctx: Context, next: () => Promise<any>) => {
    // Add dashboard endpoints to context
    ctx.dashboard = {
      getMetrics: async () => {
        if (ctx.metrics) {
          return await ctx.metrics.getMetrics();
        }
        return '# No metrics available';
      },

      getHealth: () => {
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        };

        // Check if critical services are healthy
        if (ctx.memory) {
          const memStats = ctx.memory.getStats();
          if (memStats.current.heapUsed > memStats.current.heapTotal * 0.9) {
            health.status = 'warning';
          }
        }

        return health;
      },

      getStats: () => {
        return {
          requests: ctx.metrics?.manager ? 'Available via /metrics' : 'Metrics not enabled',
          memory: ctx.memory?.getStats() || 'Memory monitoring not enabled',
          tracing: ctx.tracing ? 'Enabled' : 'Disabled',
          loadBalancer: ctx.loadBalancer?.getStats() || 'Load balancer not enabled',
          circuitBreaker: ctx.circuitBreaker?.getStats() || 'Circuit breaker not enabled'
        };
      }
    };

    await next();
  };
}

// Helper function to create a simple dashboard HTML
export function createDashboardHTML(): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>OpenSpeed Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .healthy { color: green; }
        .warning { color: orange; }
        .error { color: red; }
        .chart { height: 200px; background: #eee; margin: 10px 0; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <h1>OpenSpeed Real-time Dashboard</h1>

    <div class="metric">
        <h3>System Health</h3>
        <div id="health-status">Loading...</div>
    </div>

    <div class="metric">
        <h3>Memory Usage</h3>
        <div class="chart" id="memory-chart">Memory Chart</div>
    </div>

    <div class="metric">
        <h3>Request Rate</h3>
        <div class="chart" id="requests-chart">Requests Chart</div>
    </div>

    <div class="metric">
        <h3>Active Connections</h3>
        <div id="connections">Loading...</div>
    </div>

    <script>
        async function updateDashboard() {
            try {
                const [healthRes, statsRes] = await Promise.all([
                    fetch('/api/dashboard/health'),
                    fetch('/api/dashboard/stats')
                ]);

                const health = await healthRes.json();
                const stats = await statsRes.json();

                // Update health status
                const healthEl = document.getElementById('health-status');
                healthEl.className = health.status;
                healthEl.textContent = \`Status: \${health.status.toUpperCase()}\`;

                // Update memory info
                const memoryEl = document.getElementById('memory-chart');
                const memMB = (health.memory.heapUsed / 1024 / 1024).toFixed(2);
                memoryEl.textContent = \`Heap Used: \${memMB} MB\`;

                // Update connections
                const connEl = document.getElementById('connections');
                connEl.textContent = \`Uptime: \${Math.floor(health.uptime)}s\`;

            } catch (error) {
                console.error('Dashboard update failed:', error);
            }
        }

        // Update every 5 seconds
        setInterval(updateDashboard, 5000);
        updateDashboard(); // Initial load
    </script>
</body>
</html>`;
}