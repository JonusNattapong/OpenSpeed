import { Hono } from 'hono';

// Health check
const app = new Hono();

app.get('/health', (c) => {
  return c.json({ status: 'ok', framework: 'hono', scenario: 'routing' });
});

// Simple routing benchmark
app.get('/', (c) => {
  return c.text('Hello World');
});

app.get('/user/:id', (c) => {
  const id = c.req.param('id');
  return c.json({ userId: id, name: `User ${id}` });
});

app.get('/api/v1/users/:userId/posts/:postId', (c) => {
  const userId = c.req.param('userId');
  const postId = c.req.param('postId');
  return c.json({
    userId,
    postId,
    title: `Post ${postId} by User ${userId}`,
    content: 'This is a sample post content for benchmarking purposes.'
  });
});

app.post('/api/data', (c) => {
  return c.json({ received: true, method: 'POST' });
});

app.put('/api/users/:id', (c) => {
  const id = c.req.param('id');
  return c.json({ updated: true, userId: id });
});

app.delete('/api/users/:id', (c) => {
  const id = c.req.param('id');
  return c.json({ deleted: true, userId: id });
});

// Nested routes
const api = new Hono();

api.get('/status', (c) => {
  return c.json({ api: 'v2', status: 'active' });
});

api.get('/metrics', (c) => {
  return c.json({
    requests: 1000,
    errors: 0,
    avgResponseTime: 15
  });
});

app.route('/api/v2', api);

// Query parameters
app.get('/search', (c) => {
  const q = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '10');
  const offset = parseInt(c.req.query('offset') || '0');

  return c.json({
    query: q,
    limit,
    offset,
    results: Array.from({ length: Math.min(limit, 100) }, (_, i) => ({
      id: offset + i + 1,
      title: `Result ${offset + i + 1} for "${q}"`,
      score: Math.random()
    }))
  });
});

// Regex routes
app.get('/files/:filename{\\w+\\.\\w+}', (c) => {
  const filename = c.req.param('filename');
  return c.json({
    filename,
    size: Math.floor(Math.random() * 1000000),
    type: filename.split('.').pop()
  });
});

// Wildcard routes
app.get('/assets/*', (c) => {
  const path = c.req.path.slice(8); // Remove '/assets/'
  return c.json({
    path,
    served: true,
    contentType: path.endsWith('.js') ? 'application/javascript' :
                 path.endsWith('.css') ? 'text/css' :
                 'text/plain'
  });
});

const port = process.argv[2] || 3100;
export default {
  port,
  fetch: app.fetch,
};