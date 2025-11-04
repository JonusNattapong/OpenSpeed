import type { Context } from '../context.js';
import { RouteVisualizer } from './routeVisualizer.js';
import { PerformanceMonitor } from './performanceMonitor.js';

interface DevToolsOptions {
  enabled?: boolean;
  routeVisualizer?: boolean;
  performanceMonitor?: boolean;
  autoReload?: boolean;
  hotReload?: boolean;
  playground?: boolean;
}

/**
 * Development tools plugin - combines multiple development utilities
 */
export class DevTools {
  private routeVisualizer: RouteVisualizer | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private options: Required<DevToolsOptions>;

  constructor(options: DevToolsOptions = {}) {
    this.options = {
      enabled: process.env.NODE_ENV === 'development',
      routeVisualizer: true,
      performanceMonitor: true,
      autoReload: true,
      hotReload: false,
      playground: true,
      ...options,
    };
  }

  /**
   * Initialize development tools
   */
  initialize() {
    if (this.options.routeVisualizer) {
      this.routeVisualizer = new RouteVisualizer();
    }

    if (this.options.performanceMonitor) {
      this.performanceMonitor = new PerformanceMonitor();
    }
  }

  /**
   * Get route visualizer instance
   */
  getRouteVisualizer(): RouteVisualizer | null {
    return this.routeVisualizer;
  }

  /**
   * Get performance monitor instance
   */
  getPerformanceMonitor(): PerformanceMonitor | null {
    return this.performanceMonitor;
  }

  /**
   * Add route to visualizer
   */
  addRoute(method: string, path: string, handler: Function, middleware: Function[] = []) {
    if (this.routeVisualizer) {
      this.routeVisualizer.addRoute(method, path, handler, middleware);
    }
  }

  /**
   * Generate development dashboard HTML
   */
  generateDashboardHTML(): string {
    const routes = this.routeVisualizer?.getRoutes() || [];
    const perfStats = this.performanceMonitor?.getStats() || {
      totalRequests: 0,
      averageResponseTime: 0,
      slowestRequest: 0,
      fastestRequest: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      slowRequests: 0,
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenSpeed DevTools</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa; color: #333; line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white; padding: 30px; text-align: center;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card {
            background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .card-header {
            background: #f1f5f9; padding: 15px 20px; font-weight: bold; border-bottom: 2px solid #e2e8f0;
            display: flex; align-items: center; gap: 10px;
        }
        .card-content { padding: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .stat { text-align: center; }
        .stat-number { font-size: 1.8rem; font-weight: bold; color: #6366f1; }
        .stat-label { color: #666; font-size: 0.9rem; margin-top: 5px; }
        .routes { max-height: 300px; overflow-y: auto; }
        .route { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 10px; }
        .route:last-child { border-bottom: none; }
        .method {
            padding: 3px 8px; border-radius: 3px; font-weight: bold; font-size: 0.7rem; min-width: 50px; text-align: center;
        }
        .method.GET { background: #10b981; color: white; }
        .method.POST { background: #f59e0b; color: white; }
        .method.PUT { background: #3b82f6; color: white; }
        .method.DELETE { background: #ef4444; color: white; }
        .method.PATCH { background: #8b5cf6; color: white; }
        .path { font-family: 'Monaco', monospace; flex: 1; font-size: 0.9rem; }
        .handler { color: #666; font-size: 0.8rem; }
        .actions { display: flex; gap: 10px; margin-bottom: 20px; }
        .btn {
            padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;
            text-decoration: none; display: inline-flex; align-items: center; gap: 5px;
        }
        .btn.primary { background: #6366f1; color: white; }
        .btn.secondary { background: #6b7280; color: white; }
        .btn:hover { opacity: 0.9; }
        .playground { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 15px; }
        .playground textarea {
            width: 100%; min-height: 100px; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px;
            font-family: 'Monaco', monospace; font-size: 0.9rem; margin-bottom: 10px;
        }
        .playground .output {
            background: #1f2937; color: #10b981; padding: 10px; border-radius: 4px;
            font-family: 'Monaco', monospace; font-size: 0.8rem; white-space: pre-wrap;
        }
        .no-data { text-align: center; padding: 20px; color: #666; font-style: italic; }
        .refresh { position: fixed; bottom: 20px; right: 20px; background: #6366f1; color: white;
                   padding: 12px 20px; border-radius: 50px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                   transition: all 0.3s; }
        .refresh:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛠️ OpenSpeed DevTools</h1>
        <p>Development dashboard for your OpenSpeed application</p>
    </div>

    <div class="container">
        <div class="actions">
            <a href="/_routes" class="btn primary">📍 Routes</a>
            <a href="/_performance" class="btn primary">⚡ Performance</a>
            <button class="btn secondary" onclick="clearData()">🗑️ Clear All</button>
            <button class="btn secondary" onclick="exportData()">📊 Export</button>
        </div>

        <div class="grid">
            <!-- Routes Overview -->
            <div class="card">
                <div class="card-header">
                    📍 Routes Overview
                </div>
                <div class="card-content">
                    <div class="stats-grid">
                        <div class="stat">
                            <div class="stat-number">${routes.length}</div>
                            <div class="stat-label">Total Routes</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${new Set(routes.map((r) => r.method)).size}</div>
                            <div class="stat-label">Methods</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${routes.filter((r) => r.method === 'GET').length}</div>
                            <div class="stat-label">GET Routes</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${routes.filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method)).length}</div>
                            <div class="stat-label">Write Routes</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Performance Overview -->
            <div class="card">
                <div class="card-header">
                    ⚡ Performance Overview
                </div>
                <div class="card-content">
                    <div class="stats-grid">
                        <div class="stat">
                            <div class="stat-number">${perfStats.totalRequests}</div>
                            <div class="stat-label">Total Requests</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${perfStats.averageResponseTime.toFixed(0)}ms</div>
                            <div class="stat-label">Avg Response</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${perfStats.requestsPerSecond.toFixed(1)}</div>
                            <div class="stat-label">Req/sec</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${perfStats.errorRate.toFixed(1)}%</div>
                            <div class="stat-label">Error Rate</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recent Routes -->
            <div class="card">
                <div class="card-header">
                    🗂️ Recent Routes
                </div>
                <div class="card-content">
                    <div class="routes">
                        ${routes
                          .slice(-10)
                          .reverse()
                          .map(
                            (route) => `
                            <div class="route">
                                <span class="method ${route.method}">${route.method}</span>
                                <span class="path">${route.path}</span>
                                <span class="handler">${route.handler}</span>
                            </div>
                        `
                          )
                          .join('')}
                        ${routes.length === 0 ? '<div class="no-data">No routes registered yet</div>' : ''}
                    </div>
                </div>
            </div>

            <!-- API Playground -->
            ${
              this.options.playground
                ? `
            <div class="card">
                <div class="card-header">
                    🎮 API Playground
                </div>
                <div class="card-content">
                    <div class="playground">
                        <textarea id="apiRequest" placeholder="Enter your API request here...
Example:
GET /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}"></textarea>
                        <button class="btn primary" onclick="sendRequest()">🚀 Send Request</button>
                        <div id="apiOutput" class="output">Response will appear here...</div>
                    </div>
                </div>
            </div>
            `
                : ''
            }
        </div>
    </div>

    <a href="/_devtools" class="refresh" onclick="window.location.reload()">🔄 Refresh</a>

    <script>
        async function sendRequest() {
            const requestText = document.getElementById('apiRequest').value;
            const output = document.getElementById('apiOutput');

            if (!requestText.trim()) {
                output.textContent = 'Please enter a request';
                return;
            }

            try {
                const lines = requestText.split('\\n');
                const firstLine = lines[0].split(' ');
                const method = firstLine[0];
                const url = firstLine[1];

                const headers = {};
                let bodyStart = 1;

                // Parse headers
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) {
                        bodyStart = i + 1;
                        break;
                    }
                    const [key, ...valueParts] = line.split(':');
                    if (key && valueParts.length > 0) {
                        headers[key.trim()] = valueParts.join(':').trim();
                    }
                }

                const body = lines.slice(bodyStart).join('\\n').trim();

                const response = await fetch(url, {
                    method: method,
                    headers: headers,
                    body: body || undefined
                });

                const responseText = await response.text();
                output.textContent = \`HTTP \${response.status} \${response.statusText}
\${Array.from(response.headers.entries()).map(([k, v]) => \`\${k}: \${v}\`).join('\\n')}

\${responseText}\`;

            } catch (error) {
                output.textContent = \`Error: \${error.message}\`;
            }
        }

        function clearData() {
            if (confirm('Clear all development data?')) {
                fetch('/_performance/clear', { method: 'POST' });
                // Routes are cleared automatically on restart
                window.location.reload();
            }
        }

        function exportData() {
            const data = {
                routes: ${JSON.stringify(routes)},
                performance: ${JSON.stringify(perfStats)},
                timestamp: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'devtools-export.json';
            a.click();
            URL.revokeObjectURL(url);
        }

        // Auto-refresh every 30 seconds in development
        if (${this.options.enabled}) {
            setTimeout(() => window.location.reload(), 30000);
        }
    </script>
</body>
</html>`;
  }
}

// Global dev tools instance
let globalDevTools: DevTools | null = null;

/**
 * Development tools middleware
 */
export function devTools(options: DevToolsOptions = {}) {
  const devtools = new DevTools(options);
  devtools.initialize();
  globalDevTools = devtools;

  return async (ctx: Context, next: () => Promise<void>) => {
    // Handle dev tools dashboard endpoint
    if (ctx.req.url === '/_devtools') {
      ctx.res.headers = ctx.res.headers || {};
      ctx.res.headers['content-type'] = 'text/html';
      ctx.res.body = devtools.generateDashboardHTML();
      return;
    }

    await next();
  };
}

/**
 * Get the global dev tools instance
 */
export function getDevTools(): DevTools | null {
  return globalDevTools;
}

/**
 * Add route to dev tools (convenience function)
 */
export function addRouteToDevTools(
  method: string,
  path: string,
  handler: Function,
  middleware: Function[] = []
) {
  if (globalDevTools) {
    globalDevTools.addRoute(method, path, handler, middleware);
  }
}

/**
 * Print development info to console
 */
export function printDevInfo() {
  if (globalDevTools) {
    console.log('\n🛠️ OpenSpeed DevTools Active');
    console.log('📍 Routes: http://localhost:3000/_routes');
    console.log('⚡ Performance: http://localhost:3000/_performance');
    console.log('🛠️ DevTools Dashboard: http://localhost:3000/_devtools\n');
  }
}
