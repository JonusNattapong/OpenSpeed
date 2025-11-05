import Router from './router.js';
import Context, { RequestLike, ResponseLike } from './context.js';
import { createServer } from './server.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

type Middleware = (ctx: Context, next: () => Promise<unknown>) => Promise<unknown>;
type RouteHandler = (ctx: Context) => Promise<ResponseLike> | ResponseLike;

export interface Plugin {
  name: string;
  setup: (app: OpenSpeedApp) => void;
}

export interface OpenSpeedApp {
  use(fn: Middleware): OpenSpeedApp;
  decorate(key: string, value: unknown): OpenSpeedApp;
  plugin(nameOrPlugin: string | Plugin, pluginFn?: (app: OpenSpeedApp) => void): OpenSpeedApp;
  routes(): Array<{ method: string; path: string; middlewares: string[] }>;
  printRoutes(): OpenSpeedApp;
  loadRoutes(routesDir: string, options?: { prefix?: string }): Promise<OpenSpeedApp>;
  get(path: string, ...args: Middleware[]): OpenSpeedApp;
  post(path: string, ...args: Middleware[]): OpenSpeedApp;
  put(path: string, ...args: Middleware[]): OpenSpeedApp;
  delete(path: string, ...args: Middleware[]): OpenSpeedApp;
  patch(path: string, ...args: Middleware[]): OpenSpeedApp;
  options(path: string, ...args: Middleware[]): OpenSpeedApp;
  handle(req: RequestLike): Promise<ResponseLike>;
  listen(port?: number): Promise<unknown>;
  [key: string]: unknown; // Allow decorated properties
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options'] as const;

function runStack(
  ctx: Context,
  stack: Middleware[],
  terminal: () => Promise<ResponseLike>
): Promise<ResponseLike> {
  if (!stack.length) {
    return terminal();
  }

  let next = terminal;

  for (let i = stack.length - 1; i >= 0; i--) {
    const middleware = stack[i];
    const currentNext = next;
    next = () => Promise.resolve(middleware(ctx, currentNext) as Promise<ResponseLike>);
  }

  return next();
}

function composeRoute(middlewares: Middleware[], handler: RouteHandler): RouteHandler {
  if (!middlewares.length) {
    return handler;
  }
  return (ctx: Context) => runStack(ctx, middlewares, () => Promise.resolve(handler(ctx)));
}

function pathnameFromUrl(url: string) {
  if (!url) return '/';

  const protocolIndex = url.indexOf('://');
  let pathStart = 0;

  if (protocolIndex !== -1) {
    const firstSlash = url.indexOf('/', protocolIndex + 3);
    if (firstSlash === -1) return '/';
    pathStart = firstSlash;
  }

  const queryIndex = url.indexOf('?', pathStart);
  const pathname = queryIndex === -1 ? url.slice(pathStart) : url.slice(pathStart, queryIndex);

  if (!pathname) return '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function createApp(): OpenSpeedApp {
  const router = new Router();
  const globalMiddlewares: Middleware[] = [];

  const app: any = {
    use(fn: Middleware) {
      globalMiddlewares.push(fn);
      return app;
    },
    decorate(key: string, value: unknown) {
      app[key] = value;
      return app;
    },
    plugin(nameOrPlugin: string | Plugin, pluginFn?: (app: OpenSpeedApp) => void) {
      if (typeof nameOrPlugin === 'object' && nameOrPlugin.setup) {
        // Plugin object with setup method
        nameOrPlugin.setup(app);
      } else if (typeof nameOrPlugin === 'string' && pluginFn) {
        // Legacy plugin function
        pluginFn(app);
      }
      return app;
    },
    routes() {
      return router.getRoutes();
    },
    printRoutes() {
      const routes = router.getRoutes();
      if (!routes.length) {
        console.log('No routes registered yet.');
        return app;
      }
      const sorted = [...routes].sort((a, b) => {
        if (a.path === b.path) return a.method.localeCompare(b.method);
        return a.path.localeCompare(b.path);
      });
      const methodWidth = sorted.reduce((max, route) => Math.max(max, route.method.length), 0);
      const pathWidth = sorted.reduce((max, route) => Math.max(max, route.path.length), 6);
      console.log('Registered routes:');
      for (const route of sorted) {
        const method = route.method.padEnd(methodWidth, ' ');
        const path = route.path.padEnd(pathWidth, ' ');
        const middlewares = route.middlewares.length ? ` [${route.middlewares.join(', ')}]` : '';
        console.log(`  ${method}  ${path}${middlewares}`);
      }
      return app;
    },
  };

  // Load routes from a filesystem directory (file-based routing)
  // - `routesDir` can be absolute or relative to process.cwd()
  // - Files export HTTP methods as named exports (GET, POST, PUT, PATCH, DELETE, OPTIONS)
  // - File/folder names with [param] become :param in route path
  app.loadRoutes = async (routesDir: string, options: { prefix?: string } = {}) => {
    const prefix = options.prefix || '';
    const abs = path.isAbsolute(routesDir) ? routesDir : path.join(process.cwd(), routesDir);

    async function walk(dir: string) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          await walk(full);
          continue;
        }
        if (!/\.(js|ts|mjs|cjs)$/.test(ent.name)) continue;

        // compute route path from file path
        let rel = path.relative(abs, full).split(path.sep).join('/');
        rel = rel.replace(/\.(js|ts|mjs|cjs)$/, '');
        // remove trailing /index
        if (rel.endsWith('/index')) rel = rel.slice(0, -'/index'.length);
        if (rel === 'index') rel = '';
        // map [param] -> :param
        const parts = rel
          .split('/')
          .filter(Boolean)
          .map((p) => p.replace(/^\[(.+)\]$/, ':$1'));
        const routePath = ('/' + [prefix, ...parts].filter(Boolean).join('/')).replace(/\/+/g, '/');

        // dynamic import
        const url = pathToFileURL(full).href;
        let mod: Record<string, unknown>;
        try {
          mod = await import(url);
        } catch (err) {
          // swallow module load errors but log for developer
          console.error(`Failed to import route file ${full}:`, err);
          continue;
        }

        // register exported HTTP method handlers
        for (const m of HTTP_METHODS) {
          const name = m.toUpperCase();
          const fn = mod[name] || mod[name.toLowerCase()];
          if (typeof fn === 'function') {
            // wrap handler to match internal RouteHandler signature
            const handler: RouteHandler = (ctx: Context) =>
              Promise.resolve(fn(ctx) as ResponseLike);
            const middlewareNames = [`file:${path.relative(process.cwd(), full)}`];
            router.add(name, routePath, handler, middlewareNames);
          }
        }
      }
    }

    await walk(abs);
    return app;
  };

  for (const method of HTTP_METHODS) {
    app[method] = (path: string, ...args: Middleware[]) => {
      if (args.length === 0) {
        throw new Error(`Route handler required for ${method.toUpperCase()} ${path}`);
      }
      const handler = args[args.length - 1] as RouteHandler;
      const routeMiddlewares = args.slice(0, -1) as Middleware[];
      const compiledHandler = composeRoute(routeMiddlewares, handler);
      const middlewareNames = routeMiddlewares.map((m) => m.name || 'anonymous');
      router.add(method.toUpperCase(), path, compiledHandler, middlewareNames);
      return app;
    };
  }

  app.handle = async (req: RequestLike) => {
    const match = router.find(req.method, pathnameFromUrl(req.url));

    if (!match) {
      return { status: 404, headers: { 'content-type': 'text/plain' }, body: 'Not Found' };
    }

    const ctx = new Context(req, match.params);
    const executeRoute = () => Promise.resolve(match.handler(ctx));
    const result = await runStack(ctx, globalMiddlewares, executeRoute);

    return result ?? ctx.res;
  };

  app.listen = async (port = 3000) => {
    const server = await createServer(app);
    server.listen(port);
    const shouldPrint =
      typeof console !== 'undefined' &&
      typeof console.log === 'function' &&
      (typeof process === 'undefined' || process.env.NODE_ENV !== 'production');
    if (shouldPrint) {
      app.printRoutes();
    }
    return server;
  };

  return app;
}

export const Openspeed = createApp;

export * from './plugins/index.js';

export default Openspeed;
