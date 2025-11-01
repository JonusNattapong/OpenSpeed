import { Openspeed } from '../../src/openspeed/index.js';
import type { Context } from '../../src/openspeed/context.js';
import { jsonConfig } from '../shared/json.js';

// Extend Context for benchmark properties
interface BenchmarkContext extends Context {
  startTime?: number;
  user?: any;
  requestId?: string;
}

const app = Openspeed();

// Register routes from shared config
for (const route of jsonConfig) {
  const handler = async (ctx: Context) => {
    const body = ctx.getBody ? await ctx.getBody() : undefined;
    const query: any = {};
    // Assuming ctx.getQuery returns an object or we can build it
    // For simplicity, since getQuery might not exist, let's assume we can get query params
    // In Openspeed, ctx.req.url has query, but to simplify, let's pass empty for now
    // Actually, in the original code, it uses ctx.getQuery('size'), so assume getQuery exists
    const queryObj = {
      size: ctx.getQuery ? ctx.getQuery('size') : undefined,
      chunks: ctx.getQuery ? ctx.getQuery('chunks') : undefined,
      chunkSize: ctx.getQuery ? ctx.getQuery('chunkSize') : undefined,
    };
    const response = route.response(body, queryObj);
    return ctx.json(response.data, response.status);
  };
  app[route.method](route.path, handler);
}

const port = process.argv[2] || '3001';
app.listen(parseInt(port), () => {
  console.log(`OpenSpeed JSON Benchmark listening on port ${port}`);
});
