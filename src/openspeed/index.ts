import Router from './router.js';
import Context, { RequestLike } from './context.js';
import { createServer } from './server.js';

type Middleware = (ctx: Context, next: () => Promise<any>) => any;
type RouteHandler = (ctx: Context) => Promise<any> | any;

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options'] as const;

function runStack(ctx: Context, stack: Middleware[], terminal: () => Promise<any> | any) {
  if (stack.length === 0) {
    return Promise.resolve(terminal());
  }

  let next = terminal;

  for (let i = stack.length - 1; i >= 0; i--) {
    const middleware = stack[i];
    const currentNext = next;
    next = () => Promise.resolve(middleware(ctx, currentNext));
  }

  return next();
}

function composeRoute(middlewares: Middleware[], handler: RouteHandler): RouteHandler {
  if (!middlewares.length) {
    return handler;
  }
  return (ctx: Context) => runStack(ctx, middlewares, () => handler(ctx));
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

export function createApp() {
  const router = new Router();
  const globalMiddlewares: Middleware[] = [];

  const app: any = {
    use(fn: Middleware) {
      globalMiddlewares.push(fn);
      return app;
    },
    decorate(key: string, value: any) {
      app[key] = value;
      return app;
    },
    plugin(_name: string, pluginFn: (app: any) => void) {
      pluginFn(app);
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
    }
  };

  for (const method of HTTP_METHODS) {
    app[method] = (path: string, ...args: any[]) => {
      if (args.length === 0) {
        throw new Error(`Route handler required for ${method.toUpperCase()} ${path}`);
      }
      const handler = args[args.length - 1] as RouteHandler;
      const routeMiddlewares = args.slice(0, -1) as Middleware[];
      const compiledHandler = composeRoute(routeMiddlewares, handler);
      const middlewareNames = routeMiddlewares.map(m => m.name || 'anonymous');
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

export * from './plugins/index.js';

export default createApp;
