/**
 * File-Based Routing Example
 *
 * This example demonstrates OpenSpeed's file-based routing system,
 * similar to Next.js App Router but optimized for backend APIs.
 *
 * Features:
 * - Automatic route generation from file structure
 * - Dynamic routes with [param] syntax
 * - Nested layouts
 * - Route groups
 * - Middleware per route
 * - TypeScript support
 */

import { createApp } from '../../src/openspeed/index.js';
import { fileRouting, watchRoutes } from '../../src/openspeed/plugins/fileRouting.js';
import type { Context } from '../../src/openspeed/context.js';

// Create app
const app = createApp();

// Global middleware
app.use(async (ctx: Context, next) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  return next();
});

// Health check (traditional routing)
app.get('/health', (ctx: Context) => {
  return ctx.json({
    status: 'healthy',
    framework: 'openspeed',
    routing: 'file-based',
    timestamp: new Date().toISOString(),
  });
});

// API info endpoint
app.get('/api', (ctx: Context) => {
  return ctx.json({
    name: 'OpenSpeed File-Based Routing API',
    version: '1.0.0',
    routes: app.routes(),
    docs: 'See /api/users and /api/posts for examples',
  });
});

// Load file-based routes
await app.loadRoutes('examples/file-based-routing/routes', {
  prefix: '/api',
});

// In development, watch for route changes
if (process.env.NODE_ENV === 'development') {
  await watchRoutes('examples/file-based-routing/routes', app, {
    basePath: '/api',
    hot: true,
  });
}

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🚀 OpenSpeed File-Based Routing Demo                        ║
║   Server: http://localhost:${port}                                 ║
║   API Routes: http://localhost:${port}/api/*                      ║
║   Health: http://localhost:${port}/health                          ║
╚════════════════════════════════════════════════════════════════╝
`);

await app.listen(port);
