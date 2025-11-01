import { Openspeed } from '../../src/openspeed/index.js';
import type { Context } from '../../src/openspeed/context.js';

// Extend Context for benchmark properties
interface BenchmarkContext extends Context {
  startTime?: number;
  user?: any;
  requestId?: string;
}

const app = Openspeed();

// Health check
app.get('/health', (ctx: BenchmarkContext) => {
  return ctx.json({ status: 'ok', framework: 'openspeed', scenario: 'routing' });
});

// Simple routing benchmark
app.get('/', (ctx: Context) => {
  return ctx.text('Hello World');
});

app.get('/user/:id', (ctx: Context) => {
  const id = ctx.params.id;
  return ctx.json({ userId: id, name: `User ${id}` });
});

app.get('/api/v1/users/:userId/posts/:postId', (ctx: Context) => {
  const { userId, postId } = ctx.params;
  return ctx.json({
    userId,
    postId,
    title: `Post ${postId} by User ${userId}`,
    content: 'This is a sample post content for benchmarking purposes.',
  });
});

app.post('/api/data', (ctx: Context) => {
  return ctx.json({ received: true, method: 'POST' });
});

app.put('/api/users/:id', (ctx: Context) => {
  const id = ctx.params.id;
  return ctx.json({ updated: true, userId: id });
});

app.delete('/api/users/:id', (ctx: Context) => {
  const id = ctx.params.id;
  return ctx.json({ deleted: true, userId: id });
});

// Nested routes
const api = createApp();

api.get('/status', (ctx: Context) => {
  return ctx.json({ api: 'v2', status: 'active' });
});

api.get('/metrics', (ctx: Context) => {
  return ctx.json({
    requests: 1000,
    errors: 0,
    avgResponseTime: 15,
  });
});

app.use('/api/v2', api);

// Query parameters
app.get('/search', (ctx: Context) => {
  const q = ctx.getQuery('q') || '';
  const limit = parseInt(ctx.getQuery('limit') || '10');
  const offset = parseInt(ctx.getQuery('offset') || '0');

  return ctx.json({
    query: q,
    limit,
    offset,
    results: Array.from({ length: Math.min(limit, 100) }, (_, i) => ({
      id: offset + i + 1,
      title: `Result ${offset + i + 1} for "${q}"`,
      score: Math.random(),
    })),
  });
});

// Regex routes
app.get('/files/:filename(\\w+\\.\\w+)', (ctx: Context) => {
  const filename = ctx.params.filename;
  return ctx.json({
    filename,
    size: Math.floor(Math.random() * 1000000),
    type: filename.split('.').pop(),
  });
});

// Wildcard routes
app.get('/assets/*', (ctx: Context) => {
  const path = ctx.params['*'];
  return ctx.json({
    path,
    served: true,
    contentType: path.endsWith('.js')
      ? 'application/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : 'text/plain',
  });
});

const port = process.argv[2] || 3000;
app.listen(port, () => {
  console.log(`OpenSpeed Routing Benchmark listening on port ${port}`);
});
