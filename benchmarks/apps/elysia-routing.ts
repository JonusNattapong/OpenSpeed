import { Elysia } from 'elysia';

// Health check
const app = new Elysia();

app.get('/health', () => {
  return { status: 'ok', framework: 'elysia', scenario: 'routing' };
});

// Simple routing benchmark
app.get('/', () => {
  return 'Hello World';
});

app.get('/user/:id', ({ params }) => {
  const { id } = params;
  return { userId: id, name: `User ${id}` };
});

app.get('/api/v1/users/:userId/posts/:postId', ({ params }) => {
  const { userId, postId } = params;
  return {
    userId,
    postId,
    title: `Post ${postId} by User ${userId}`,
    content: 'This is a sample post content for benchmarking purposes.'
  };
});

app.post('/api/data', () => {
  return { received: true, method: 'POST' };
});

app.put('/api/users/:id', ({ params }) => {
  const { id } = params;
  return { updated: true, userId: id };
});

app.delete('/api/users/:id', ({ params }) => {
  const { id } = params;
  return { deleted: true, userId: id };
});

// Nested routes
const api = new Elysia();

api.get('/status', () => {
  return { api: 'v2', status: 'active' };
});

api.get('/metrics', () => {
  return {
    requests: 1000,
    errors: 0,
    avgResponseTime: 15
  };
});

app.use(api);

// Query parameters
app.get('/search', ({ query }) => {
  const q = query.q || '';
  const limit = parseInt(query.limit || '10');
  const offset = parseInt(query.offset || '0');

  return {
    query: q,
    limit,
    offset,
    results: Array.from({ length: Math.min(limit, 100) }, (_, i) => ({
      id: offset + i + 1,
      title: `Result ${offset + i + 1} for "${q}"`,
      score: Math.random()
    }))
  };
});

// Regex routes
app.get('/files/:filename', ({ params }) => {
  const { filename } = params;
  // Elysia handles regex differently, simplified for benchmark
  return {
    filename,
    size: Math.floor(Math.random() * 1000000),
    type: filename.split('.').pop()
  };
});

// Wildcard routes
app.get('/assets/*', ({ params }) => {
  const path = params['*'];
  return {
    path,
    served: true,
    contentType: path.endsWith('.js') ? 'application/javascript' :
                 path.endsWith('.css') ? 'text/css' :
                 'text/plain'
  };
});

const port = process.argv[2] || 3200;
app.listen(port, () => {
  console.log(`Elysia Routing Benchmark listening on port ${port}`);
});