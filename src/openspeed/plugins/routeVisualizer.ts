import type { Context } from '../context.js';

interface RouteInfo {
  method: string;
  path: string;
  handler: string;
  middleware: string[];
  file?: string;
  line?: number;
}

interface RouteVisualizerOptions {
  enabled?: boolean;
  endpoint?: string;
  includeMiddleware?: boolean;
  groupByFile?: boolean;
  showInConsole?: boolean;
}

/**
 * Route visualizer for development - shows all registered routes
 */
export class RouteVisualizer {
  private routes: RouteInfo[] = [];
  private _options: Required<RouteVisualizerOptions>;

  constructor(options: RouteVisualizerOptions = {}) {
    this._options = {
      enabled: process.env.NODE_ENV === 'development',
      endpoint: '/_routes',
      includeMiddleware: true,
      groupByFile: false,
      showInConsole: true,
      ...options
    };
  }
  
  get options(): Required<RouteVisualizerOptions> {
    return this._options;
  }

  /**
   * Add a route to the visualizer
   */
  addRoute(method: string, path: string, handler: Function, middleware: Function[] = [], file?: string, line?: number) {
    this.routes.push({
      method: method.toUpperCase(),
      path,
      handler: handler.name || 'anonymous',
      middleware: middleware.map(m => m.name || 'anonymous'),
      file,
      line
    });

    if (this._options.showInConsole) {
      console.log(`📍 ${method.toUpperCase()} ${path} → ${handler.name || 'anonymous'}`);
    }
  }

  /**
   * Get all routes
   */
  getRoutes(): RouteInfo[] {
    return [...this.routes];
  }

  /**
   * Get routes grouped by file
   */
  getRoutesByFile(): Record<string, RouteInfo[]> {
    const grouped: Record<string, RouteInfo[]> = {};

    for (const route of this.routes) {
      const file = route.file || 'unknown';
      if (!grouped[file]) {
        grouped[file] = [];
      }
      grouped[file].push(route);
    }

    return grouped;
  }

  /**
   * Generate HTML visualization
   */
  generateHTML(): string {
    const routes = this._options.groupByFile ? this.getRoutesByFile() : { all: this.getRoutes() };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenSpeed Routes - ${this.routes.length} routes</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa; color: #333; line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 30px; text-align: center;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .stats { display: flex; gap: 20px; justify-content: center; margin-bottom: 30px; }
        .stat { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .stat-number { font-size: 2rem; font-weight: bold; color: #667eea; }
        .stat-label { color: #666; margin-top: 5px; }
        .routes { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .route { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 15px; }
        .route:last-child { border-bottom: none; }
        .method {
            padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; min-width: 70px; text-align: center;
        }
        .method.GET { background: #10b981; color: white; }
        .method.POST { background: #f59e0b; color: white; }
        .method.PUT { background: #3b82f6; color: white; }
        .method.DELETE { background: #ef4444; color: white; }
        .method.PATCH { background: #8b5cf6; color: white; }
        .method.OPTIONS { background: #6b7280; color: white; }
        .path { font-family: 'Monaco', monospace; flex: 1; }
        .handler { color: #666; font-size: 0.9rem; }
        .middleware { color: #888; font-size: 0.8rem; }
        .file-info { color: #999; font-size: 0.8rem; text-align: right; }
        .group-header { background: #f1f5f9; padding: 15px 20px; font-weight: bold; border-bottom: 2px solid #e2e8f0; }
        .no-routes { text-align: center; padding: 40px; color: #666; }
        .refresh { position: fixed; bottom: 20px; right: 20px; background: #667eea; color: white;
                   padding: 12px 20px; border-radius: 50px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                   transition: all 0.3s; }
        .refresh:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 OpenSpeed Route Visualizer</h1>
        <p>Explore your API routes and application structure</p>
    </div>

    <div class="container">
        <div class="stats">
            <div class="stat">
                <div class="stat-number">${this.routes.length}</div>
                <div class="stat-label">Total Routes</div>
            </div>
            <div class="stat">
                <div class="stat-number">${new Set(this.routes.map(r => r.method)).size}</div>
                <div class="stat-label">HTTP Methods</div>
            </div>
            <div class="stat">
                <div class="stat-number">${this._options.groupByFile ? Object.keys(routes).length : 1}</div>
                <div class="stat-label">${this._options.groupByFile ? 'Files' : 'Endpoints'}</div>
            </div>
        </div>

        <div class="routes">
            ${this._options.groupByFile ?
              Object.entries(routes).map(([file, fileRoutes]) => `
                <div class="group-header">📁 ${file}</div>
                ${fileRoutes.map(route => this.renderRoute(route)).join('')}
              `).join('') :
              this.routes.map(route => this.renderRoute(route)).join('')
            }

            ${this.routes.length === 0 ? '<div class="no-routes">No routes registered yet. Start building your API! 🚀</div>' : ''}
        </div>
    </div>

    <a href="${this._options.endpoint}" class="refresh" onclick="window.location.reload()">🔄 Refresh</a>

    <script>
        // Auto-refresh every 5 seconds in development
        if (${this._options.enabled}) {
            setTimeout(() => window.location.reload(), 5000);
        }
    </script>
</body>
</html>`;
  }

  private renderRoute(route: RouteInfo): string {
    return `
      <div class="route">
        <span class="method ${route.method}">${route.method}</span>
        <span class="path">${route.path}</span>
        <span class="handler">${route.handler}</span>
        ${this._options.includeMiddleware && route.middleware.length > 0 ?
          `<span class="middleware">middleware: ${route.middleware.join(', ')}</span>` : ''}
        ${route.file && route.line ?
          `<span class="file-info">${route.file}:${route.line}</span>` : ''}
      </div>
    `;
  }

  /**
   * Generate ASCII table for console output
   */
  generateASCII(): string {
    if (this.routes.length === 0) {
      return 'No routes registered.';
    }

    let output = '\n🚀 OpenSpeed Routes (' + this.routes.length + ' total)\n';
    output += '='.repeat(80) + '\n';
    output += 'METHOD'.padEnd(8) + 'PATH'.padEnd(30) + 'HANDLER'.padEnd(20) + 'MIDDLEWARE\n';
    output += '='.repeat(80) + '\n';

    for (const route of this.routes) {
      const method = route.method.padEnd(8);
      const path = route.path.padEnd(30);
      const handler = route.handler.padEnd(20);
      const middleware = this._options.includeMiddleware ?
        route.middleware.join(', ') : '';

      output += `${method}${path}${handler}${middleware}\n`;
    }

    output += '='.repeat(80) + '\n';
    return output;
  }
}

// Global route visualizer instance
let globalVisualizer: RouteVisualizer | null = null;

/**
 * Route visualizer middleware
 */
export function routeVisualizer(options: RouteVisualizerOptions = {}) {
  const visualizer = new RouteVisualizer(options);
  globalVisualizer = visualizer;

  return async (ctx: Context, next: () => Promise<any>) => {
    // Handle route visualization endpoint
    if (ctx.req.url === visualizer.options.endpoint) {
      if (!ctx.res.headers) {
        ctx.res.headers = {};
      }
      ctx.res.headers['content-type'] = 'text/html';
      ctx.res.body = visualizer.generateHTML();
      return;
    }

    await next();
  };
}

/**
 * Get the global route visualizer instance
 */
export function getRouteVisualizer(): RouteVisualizer | null {
  return globalVisualizer;
}

/**
 * Add route to visualizer (call this from your router)
 */
export function addRouteToVisualizer(method: string, path: string, handler: Function, middleware: Function[] = []) {
  if (globalVisualizer) {
    // Try to get file and line information
    const stack = new Error().stack;
    const callerLine = stack?.split('\n')[3];
    const match = callerLine?.match(/\((.+):(\d+):\d+\)/);

    globalVisualizer.addRoute(method, path, handler, middleware,
      match ? match[1] : undefined,
      match ? parseInt(match[2]) : undefined
    );
  }
}

/**
 * Print routes to console
 */
export function printRoutes() {
  if (globalVisualizer) {
    console.log(globalVisualizer.generateASCII());
  }
}