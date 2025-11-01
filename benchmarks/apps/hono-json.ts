import { Hono } from 'hono';
import { jsonConfig } from '../shared/json.js';

const app = new Hono();

// Register routes from shared config
for (const route of jsonConfig) {
  const handler = async (c: any) => {
    const body = route.method === 'post' ? await c.req.json() : undefined;
    const query = {
      size: c.req.query('size'),
      chunks: c.req.query('chunks'),
      chunkSize: c.req.query('chunkSize'),
    };
    const response = route.response(body, query);
    return c.json(response.data, response.status);
  };
  app[route.method](route.path, handler);
}

const port = process.argv[2] || '3101';
export default {
  port,
  fetch: app.fetch,
};
