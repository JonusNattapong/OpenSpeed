import { Elysia } from 'elysia';
import { routingConfig, templateResponse } from '../shared/routing.js';

// Health check
const app = new Elysia();

// Register routes from shared config
for (const route of routingConfig) {
  const handler = ({ params, query }: any) => {
    const context = {
      params,
      query,
    };
    const data = templateResponse(route.response.data, context);
    if (route.response.type === 'text') {
      return data;
    } else {
      return data;
    }
  };
  app[route.method](route.path, handler);
}

const port = process.argv[2] || 3200;
app.listen(port, () => {
  console.log(`Elysia Routing Benchmark listening on port ${port}`);
});
