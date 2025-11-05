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

// Health check
app.get('/health', (c: any) => {
  return c.json({
    status: 'ok',
    framework: 'hono',
    scenario: 'json',
  });
});

const port = process.argv[2] || '3101';

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
  console.log(`Hono JSON Benchmark listening on port ${port}`);
});
