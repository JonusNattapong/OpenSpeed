import Router from './router.js';
import Context, { RequestLike } from './context.js';
import { createServer } from './server.js';
import type { Handler } from './router.js';

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options'] as const;

type Next = () => Promise<any>;

export type Middleware<TCtx = Context> = (ctx: TCtx, next: Next) => any;

type TrimStartSlash<S extends string> = S extends `/${infer Rest}` ? TrimStartSlash<Rest> : S;
type TrimEndSlash<S extends string> = S extends `${infer Rest}/` ? TrimEndSlash<Rest> : S;

type NormalizedPrefix<P extends string> = TrimEndSlash<P> extends ''
  ? ''
  : `/${TrimStartSlash<TrimEndSlash<P>>}`;

type NormalizedPath<P extends string> = TrimEndSlash<P> extends ''
  ? '/'
  : `/${TrimStartSlash<TrimEndSlash<P>>}`;

type JoinedPath<Prefix extends string, Path extends string> = NormalizedPrefix<Prefix> extends ''
  ? NormalizedPath<Path>
  : Path extends '' | '/'
  ? NormalizedPrefix<Prefix>
  : `${NormalizedPrefix<Prefix>}${NormalizedPath<Path>}`;

type ParamModifier<S extends string> = S extends `${infer Name}?`
  ? Name
  : S extends `${infer Name}+`
  ? Name
  : S extends `${infer Name}*`
  ? Name
  : S;

type ExtractPathParams<Path extends string> =
  Path extends `${string}:${infer Param}/${infer Rest}`
    ? ParamModifier<Param> | ExtractPathParams<`/${Rest}`>
    : Path extends `${string}:${infer Param}`
    ? ParamModifier<Param>
    : Path extends `${string}*${infer Rest}`
    ? '*' | ExtractPathParams<Rest>
    : never;

export type ParamsFor<Path extends string> = [ExtractPathParams<Path>] extends [never]
  ? Record<string, string>
  : Record<ExtractPathParams<Path>, string>;

export type TypedContext<Path extends string = string> = Context & { params: ParamsFor<Path> };

export type RouteMiddleware<Path extends string> = Middleware<TypedContext<Path>>;
export type RouteHandler<Path extends string> = (ctx: TypedContext<Path>) => Promise<any> | any;
type RouteTuple<Path extends string> = [...RouteMiddleware<Path>[], RouteHandler<Path>];

type RouteOverview = { method: string; path: string; middlewares: string[] };

type RouteMethods<AppType> = {
  [K in (typeof HTTP_METHODS)[number]]: <Path extends string>(
    path: Path,
    ...handlers: RouteTuple<Path>
  ) => AppType;
};

export interface RouteGroup<Prefix extends string> extends RouteMethods<RouteGroup<Prefix>> {
  use(fn: Middleware<Context>): RouteGroup<Prefix>;
}

export interface App extends RouteMethods<App> {
  use(fn: Middleware<Context>): App;
  decorate(key: string, value: any): App;
  plugin(name: string, pluginFn: (app: App) => void): App;
  group<Prefix extends string>(prefix: Prefix, configure: (group: RouteGroup<Prefix>) => void): App;
  routes(): RouteOverview[];
  printRoutes(): App;
  handle(req: RequestLike): Promise<any>;
  listen(port?: number): Promise<any>;
}

const getMiddlewareName = (mw: Function) => mw.name || 'anonymous';

function trimTrailingSlash(path: string) {
  return path.endsWith('/') && path !== '/' ? path.replace(/\/+$/, '') : path;
}

function normalizePrefixValue(prefix: string) {
  if (!prefix || prefix === '/') return '';
  const withLeading = prefix.startsWith('/') ? prefix : `/${prefix}`;
  const normalized = trimTrailingSlash(withLeading);
  return normalized || '/';
}

function normalizeRoutePath(path: string) {
  if (!path || path === '/') return '/';
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  return `/${trimTrailingSlash(trimmed)}`;
}

function joinPaths(prefix: string, path: string) {
  const normalizedPrefix = normalizePrefixValue(prefix);
  if (!normalizedPrefix) {
    return normalizeRoutePath(path);
  }
  if (!path || path === '/') {
    return normalizedPrefix;
  }
  const normalizedChild = normalizeRoutePath(path);
  return normalizedChild === '/' ? normalizedPrefix : `${normalizedPrefix}${normalizedChild}`;
}

async function runStack<TCtx>(
  ctx: TCtx,
  stack: Middleware<TCtx>[],
  terminal: () => Promise<any> | any
) {
  let index = -1;
  const runner = async (): Promise<any> => {
    index++;
    if (index < stack.length) {
      return await stack[index](ctx, runner);
    }
    return await terminal();
  };
  return runner();
}

function composeRoute<Path extends string>(
  middlewares: RouteMiddleware<Path>[],
  handler: RouteHandler<Path>
): RouteHandler<Path> {
  if (!middlewares.length) {
    return handler;
  }
  return (ctx: TypedContext<Path>) => runStack(ctx, middlewares, () => handler(ctx));
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

export function createApp(): App {
  const router = new Router();
  const globalMiddlewares: Middleware<Context>[] = [];
  const app = {} as App;

  app.use = (fn: Middleware<Context>) => {
    globalMiddlewares.push(fn);
    return app;
  };

  app.decorate = (key: string, value: any) => {
    (app as any)[key] = value;
    return app;
  };

  app.plugin = (_name: string, pluginFn: (app: App) => void) => {
    pluginFn(app);
    return app;
  };

  app.routes = () => router.getRoutes();

  app.printRoutes = () => {
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
  };

  app.group = <Prefix extends string>(
    prefix: Prefix,
    configure: (group: RouteGroup<Prefix>) => void
  ) => {
    const normalizedPrefix = normalizePrefixValue(prefix);
    const scopedMiddlewares: Middleware<Context>[] = [];
    const scopedNames: string[] = [];
    const group = {} as RouteGroup<Prefix>;

    group.use = (fn: Middleware<Context>) => {
      scopedMiddlewares.push(fn);
      scopedNames.push(getMiddlewareName(fn));
      return group;
    };

    for (const method of HTTP_METHODS) {
      group[method] = (<Path extends string>(
        path: Path,
        ...handlers: RouteTuple<JoinedPath<Prefix, Path>>
      ) => {
        if (!handlers.length) {
          throw new Error(`Route handler required for ${method.toUpperCase()} ${joinPaths(prefix, path)}`);
        }
        const fullPath = joinPaths(normalizedPrefix, path);
        const routeHandler = handlers[handlers.length - 1] as RouteHandler<JoinedPath<Prefix, Path>>;
        const routeMiddlewares = handlers.slice(0, -1) as RouteMiddleware<JoinedPath<Prefix, Path>>[];
        const compiled = composeRoute(routeMiddlewares, routeHandler);
        const names = [...scopedNames, ...routeMiddlewares.map(getMiddlewareName)];
        const wrapped: Handler = (ctx) =>
          runStack(ctx, scopedMiddlewares, () =>
            compiled(ctx as TypedContext<JoinedPath<Prefix, Path>>)
          );
        router.add(method.toUpperCase(), fullPath, wrapped, names);
        return group;
      }) as RouteGroup<Prefix>[typeof method];
    }

    configure(group);
    return app;
  };

  for (const method of HTTP_METHODS) {
    app[method] = (<Path extends string>(path: Path, ...handlers: RouteTuple<Path>) => {
      if (!handlers.length) {
        throw new Error(`Route handler required for ${method.toUpperCase()} ${path}`);
      }
      const routeHandler = handlers[handlers.length - 1] as RouteHandler<Path>;
      const routeMiddlewares = handlers.slice(0, -1) as RouteMiddleware<Path>[];
      const compiled = composeRoute(routeMiddlewares, routeHandler);
      const names = routeMiddlewares.map(getMiddlewareName);
      const wrapped: Handler = (ctx) => compiled(ctx as TypedContext<Path>);
      router.add(method.toUpperCase(), path, wrapped, names);
      return app;
    }) as App[typeof method];
  }

  app.handle = async (req: RequestLike) => {
    const match = router.find(req.method, pathnameFromUrl(req.url));

    if (!match) {
      return { status: 404, headers: { 'content-type': 'text/plain' }, body: 'Not Found' };
    }

    const ctx = new Context(req, match.params);
    const executeRoute = () => match.handler(ctx);
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
