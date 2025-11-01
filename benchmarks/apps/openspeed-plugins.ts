OpenSpeed\benchmarks\apps\openspeed-plugins.ts
import { Openspeed } from '../../src/openspeed/index.js';
import type { Context } from '../../src/openspeed/context.js';
import { pluginChains, templatePluginResponse } from '../shared/plugins.js';

// Extend Context for benchmark properties
interface BenchmarkContext extends Context {
  startTime?: number;
  user?: any;
  requestId?: string;
  enabledPlugins?: string[];
}

const app = Openspeed();

// Apply plugin chains from shared config
for (const chain of pluginChains) {
  // Apply plugins for this chain
  for (const plugin of chain.plugins) {
    plugin.setup(app);
  }

  // Add the test route
  app.get(chain.testRoute, (ctx: Context) => {
    const context = ctx as BenchmarkContext;
    const data = templatePluginResponse(chain.expectedResponse.data, context);
    return ctx.json(data);
  });
}

const port = process.argv[2] || 3003;
app.listen(port, () => {
  console.log(`OpenSpeed Plugins Benchmark listening on port ${port}`);
});
