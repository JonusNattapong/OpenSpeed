import type { Context } from '../context.js';

interface RouteInfo {
  method: string;
  path: string;
  description?: string;
  responses?: Record<string, any>;
}

export function openapi(options: { title?: string; version?: string } = {}) {
  const routes: RouteInfo[] = [];
  const { title = 'OpenSpeed API', version = '1.0.0' } = options;

  const api = {
    collect: (method: string, path: string, description?: string) => {
      routes.push({ method: method.toLowerCase(), path, description });
    },
    generate: () => ({
      openapi: '3.0.0',
      info: { title, version },
      paths: routes.reduce((acc, route) => {
        const path = route.path.replace(/:(\w+)/g, '{$1}');
        if (!acc[path]) acc[path] = {};
        acc[path][route.method] = {
          description: route.description || '',
          responses: {
            200: { description: 'Success' }
          }
        };
        return acc;
      }, {} as any)
    }),
    middleware: async (ctx: Context, next: () => Promise<any>) => {
      const pathname = new URL(ctx.req.url, 'http://localhost').pathname;
      if (pathname === '/openapi.json') {
        ctx.res.status = 200;
        ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
        ctx.res.body = JSON.stringify(api.generate(), null, 2);
        return;
      }
      await next();
    }
  };

  return api;
}