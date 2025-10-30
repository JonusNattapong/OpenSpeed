import Router from './router';
import Context, { RequestLike } from './context';
import { createServer } from './server';

type Middleware = (ctx: Context, next: () => Promise<any>) => any;

export function createApp() {
  const router = new Router();
  const middlewares: Middleware[] = [];

  const app: any = {
    use(fn: Middleware) {
      middlewares.push(fn);
      return app;
    },
    decorate(key: string, value: any) {
      app[key] = value;
      return app;
    },
    plugin(name: string, pluginFn: (app: any) => void) {
      pluginFn(app);
      return app;
    }
  };

  const methods = ['get','post','put','delete','patch','options'] as const;
  for (const m of methods) {
    app[m] = (path: string, handler: (ctx: Context)=>any) => {
      router.add(m.toUpperCase(), path, handler);
      return app;
    };
  }

  app.handle = async (req: RequestLike) => {
    const match = router.find(req.method, new URL(req.url, 'http://localhost').pathname);
    if (!match) {
      return { status: 404, headers: { 'content-type': 'text/plain' }, body: 'Not Found' };
    }
    const ctx = new Context(req, match.params);

    // simple middleware runner
    let idx = -1;
    const runner = async () => {
      idx++;
      if (idx < middlewares.length) {
        return await middlewares[idx](ctx, runner);
      }
      // final: call handler
      const out = await match.handler(ctx);
      if (out) return out;
      return ctx.res;
    };
    const result = await runner();
    return result || ctx.res;
  };

  app.listen = (port = 3000) => {
    const server = createServer(app);
    server.listen(port);
    return server;
  };

  return app;
}

export * from './plugins/index.js';

export default createApp;
