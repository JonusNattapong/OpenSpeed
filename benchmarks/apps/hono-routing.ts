import { Hono } from 'hono';
import { routingConfig, templateResponse } from '../shared/routing.js';

const app = new Hono();

// Register routes from shared config
for (const route of routingConfig) {
  const handler = (c: any) => {
    const params: any = {};
    for (const [key, value] of Object.entries(c.req.param())) {
      params[key] = value;
    }
    const context = {
      params,
      query: {
        q: c.req.query('q'),
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
      },
    };
    const data = templateResponse(route.response.data, context);
    if (route.response.type === 'text') {
      return c.text(data);
    } else {
      return c.json(data);
    }
  };
  app[route.method](route.path, handler);
}

const port = process.argv[2] || 3100;
export default {
  port,
  fetch: app.fetch,
};
