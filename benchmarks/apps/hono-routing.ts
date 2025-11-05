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

// Health check
app.get('/health', (c: any) => {
  return c.json({
    status: 'ok',
    framework: 'hono',
    scenario: 'routing',
  });
});

// Start Node.js HTTP server
import { createServer } from 'http';

const server = createServer((req, res) => {
  app
    .fetch(
      new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
      })
    )
    .then((response) => {
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      response.text().then((text) => {
        res.end(text);
      });
    });
});

server.listen(port, () => {
  console.log(`Hono Routing Benchmark listening on port ${port}`);
});
