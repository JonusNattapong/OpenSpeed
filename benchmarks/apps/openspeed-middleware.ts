import { Openspeed } from '../../src/openspeed/index.js';
import type { Context } from '../../src/openspeed/context.js';
import { middlewareChains, templateMiddlewareResponse } from '../shared/middleware.js';

// Extend Context for benchmark properties
interface BenchmarkContext extends Context {
  startTime?: number;
  user?: any;
  requestId?: string;
  responseTime?: number;
  rateLimit?: any;
  compressed?: boolean;
  cached?: boolean;
  error?: any;
  conditional?: boolean;
  extraData?: any;
  asyncProcessed?: boolean;
  asyncTimestamp?: number;
  processedData?: any[];
}

const app = Openspeed();

// Apply middleware chains from shared config
for (const chain of middlewareChains) {
  // Apply middlewares for this chain
  for (const middleware of chain.middlewares) {
    middleware.setup(app);
  }

  // Add the test route
  app.get(chain.testRoute, (ctx: Context) => {
    const context = ctx as BenchmarkContext;
    const data = templateMiddlewareResponse(chain.expectedResponse.data, context);
    return ctx.json(data);
  });
}

const port = process.argv[2] || '3002';
app.listen(port, () => {
  console.log(`OpenSpeed Middleware Benchmark listening on port ${port}`);
});
