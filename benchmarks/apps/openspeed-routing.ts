import { Openspeed } from '../../src/openspeed/index.js';
import type { Context } from '../../src/openspeed/context.js';
import { routingConfig, templateResponse } from '../shared/routing.js';

// Extend Context for benchmark properties
interface BenchmarkContext extends Context {
  startTime?: number;
  user?: any;
  requestId?: string;
}

const app = Openspeed();

// Register routes from shared config
for (const route of routingConfig) {
  const handler = (ctx: Context) => {
    const context = {
      params: ctx.params,
      query: {
        q: ctx.getQuery('q'),
        limit: ctx.getQuery('limit'),
        offset: ctx.getQuery('offset'),
      },
    };
    const data = templateResponse(route.response.data, context);
    if (route.response.type === 'text') {
      return ctx.text(data);
    } else {
      return ctx.json(data);
    }
  };
  app[route.method](route.path, handler);
}

// Routes are handled by the config loop above

const port = process.argv[2] || 3000;
app.listen(port, () => {
  console.log(`OpenSpeed Routing Benchmark listening on port ${port}`);
});
