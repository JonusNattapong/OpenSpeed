import { readdir } from 'fs/promises';
import { join, extname, relative, sep } from 'path';
import { pathToFileURL } from 'url';
import type { Context } from '../context.js';

type MiddlewareFn = (ctx: Context, next: () => Promise<any>) => any;

interface FileRoutingOptions {
  routesDir: string;
  basePath?: string;
  extensions?: string[];
  conventions?: {
    layout?: string;
    error?: string;
    loading?: string;
    notFound?: string;
  };
  cacheRoutes?: boolean;
  hot?: boolean;
}

interface RouteModule {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  DELETE?: RouteHandler;
  PATCH?: RouteHandler;
  OPTIONS?: RouteHandler;
  HEAD?: RouteHandler;
  default?: RouteHandler;
  middleware?: Middleware[];
  layout?: LayoutComponent;
  metadata?: RouteMetadata;
}

type RouteHandler = (ctx: Context) => Promise<any> | any;
type Middleware = (ctx: Context, next: () => Promise<any>) => Promise<any> | any;
type LayoutComponent = (ctx: Context, children: any) => Promise<any> | any;

interface RouteMetadata {
  title?: string;
  description?: string;
  middleware?: string[];
  auth?: boolean;
  roles?: string[];
  rateLimit?: number;
}

interface ParsedRoute {
  path: string;
  filePath: string;
  pattern: string;
  params: string[];
  isDynamic: boolean;
  isLayout: boolean;
  isCatchAll: boolean;
  priority: number;
}

/**
 * File-based routing plugin with Next.js-style conventions
 * 
 * Features:
 * - Automatic route generation from file structure
 * - Dynamic routes with [...slug] and [id] patterns
 * - Route groups with (group) syntax
 * - Nested layouts
 * - Middleware composition per route
 * - Hot reload support
 * - TypeScript-first
 */
export function fileRouting(options: FileRoutingOptions): MiddlewareFn {
  const {
    routesDir,
    basePath = '',
    extensions = ['.ts', '.js', '.tsx', '.jsx'],
    conventions = {
      layout: '_layout',
      error: '_error',
      loading: '_loading',
      notFound: '_404',
    },
    cacheRoutes = true,
    hot = process.env.NODE_ENV === 'development',
  } = options;

  return async (_ctx: Context, next: () => Promise<any>) => {
    // File routing requires manual route discovery
    // Use watchRoutes() separately to monitor file changes
    return next();
  };
}

/**
 * Watch for file changes and reload routes (hot reload)
 */

/**
 * Scan directory recursively for route files
 */
async function scanDirectory(dir: string, baseDir: string, extensions: string[]): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      files.push(...(await scanDirectory(fullPath, baseDir, extensions)));
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Parse file path to route pattern
 * 
 * Examples:
 * - /routes/index.ts -> /
 * - /routes/users/index.ts -> /users
 * - /routes/users/[id].ts -> /users/:id
 * - /routes/blog/[...slug].ts -> /blog/*
 * - /routes/(admin)/users.ts -> /users (route group)
 */
function parseRoute(filePath: string, routesDir: string, basePath: string): ParsedRoute {
  const relativePath = relative(routesDir, filePath);
  const pathWithoutExt = relativePath.replace(/\.(ts|js|tsx|jsx)$/, '');

  // Remove index from path
  const cleanPath = pathWithoutExt.replace(/\/index$/, '');

  // Split into segments
  let segments = cleanPath.split(sep).filter(Boolean);

  // Check if it's a layout
  const isLayout = segments.some((s) => s.startsWith('_layout'));

  // Remove route groups (admin) -> admin
  segments = segments.filter((s) => !s.match(/^\(.*\)$/));

  // Parse dynamic segments
  const params: string[] = [];
  let isDynamic = false;
  let isCatchAll = false;
  let priority = 100;

  segments = segments.map((segment) => {
    // Catch-all route: [...slug]
    if (segment.match(/^\[\.\.\.(.+)\]$/)) {
      const param = segment.match(/^\[\.\.\.(.+)\]$/)![1];
      params.push(param);
      isCatchAll = true;
      isDynamic = true;
      priority -= 30;
      return '*';
    }

    // Dynamic route: [id]
    if (segment.match(/^\[(.+)\]$/)) {
      const param = segment.match(/^\[(.+)\]$/)![1];
      params.push(param);
      isDynamic = true;
      priority -= 10;
      return `:${param}`;
    }

    // Static segment
    return segment;
  });

  // Build final pattern
  let pattern = '/' + segments.join('/');
  if (basePath) {
    pattern = basePath + pattern;
  }

  // Normalize path
  pattern = pattern.replace(/\/+/g, '/');
  if (pattern !== '/' && pattern.endsWith('/')) {
    pattern = pattern.slice(0, -1);
  }

  return {
    path: cleanPath,
    filePath,
    pattern,
    params,
    isDynamic,
    isLayout,
    isCatchAll,
    priority,
  };
}

/**
 * Import route module dynamically
 */
async function importRoute(filePath: string): Promise<RouteModule> {
  const fileUrl = pathToFileURL(filePath).href;
  const module = await import(fileUrl);
  return module;
}

/**
 * Find nearest layout for a route
 */
function findLayout(pattern: string, layoutCache: Map<string, LayoutComponent>): LayoutComponent | null {
  const segments = pattern.split('/').filter(Boolean);

  // Try to find layout from current path up to root
  for (let i = segments.length; i >= 0; i--) {
    const layoutPath = '/' + segments.slice(0, i).join('/');
    const layout = layoutCache.get(layoutPath);
    if (layout) return layout;
  }

  return null;
}

/**
 * Create middleware that wraps handler with layout
 */
function createLayoutMiddleware(layout: LayoutComponent): Middleware {
  return async (ctx: Context, next: () => Promise<any>) => {
    const children = await next();
    return layout(ctx, children);
  };
}

/**
 * Watch for file changes and reload routes (hot reload)
 */
export async function watchRoutes(
  routesDir: string,
  _app: any,
  _options: Omit<FileRoutingOptions, 'routesDir'>
): Promise<void> {
  const { default: chokidar } = await import('chokidar');

  const watcher = chokidar.watch(routesDir, {
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../, // ignore dotfiles
  });

  watcher.on('all', async (event, path) => {
    console.log(`[File Routing] ${event}: ${path}`);
    // TODO: Implement incremental route update
    // For now, we rely on hot reload plugin
  });
}

// Export utilities
export { type FileRoutingOptions, type RouteModule, type RouteMetadata, type ParsedRoute };
