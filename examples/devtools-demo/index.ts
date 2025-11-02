import { OpenSpeed } from '../../src/openspeed/index.js';
import { devTools, addRouteToDevTools } from '../../src/openspeed/plugins/devTools.js';

const app = new OpenSpeed();

// Enable development tools
app.use(devTools({
  enabled: true,
  routeVisualizer: true,
  performanceMonitor: true,
  playground: true
}));

// Example API routes
app.get('/api/users', async (ctx) => {
  // Simulate database delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

  addRouteToDevTools('GET', '/api/users', arguments.callee);

  return ctx.json({
    users: [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ],
    total: 2
  });
});

app.post('/api/users', async (ctx) => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 200));

  addRouteToDevTools('POST', '/api/users', arguments.callee);

  const { name, email } = ctx.req.body as any;

  if (!name || !email) {
    ctx.res.status = 400;
    return ctx.json({ error: 'Name and email are required' });
  }

  return ctx.json({
    id: Date.now(),
    name,
    email,
    createdAt: new Date().toISOString()
  });
});

app.get('/api/users/:id', async (ctx) => {
  addRouteToDevTools('GET', '/api/users/:id', arguments.callee);

  const id = parseInt(ctx.params.id);

  if (id === 1) {
    return ctx.json({
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      posts: 15,
      followers: 120
    });
  }

  ctx.res.status = 404;
  return ctx.json({ error: 'User not found' });
});

app.put('/api/users/:id', async (ctx) => {
  // Simulate slow update operation
  await new Promise(resolve => setTimeout(resolve, Math.random() * 300));

  addRouteToDevTools('PUT', '/api/users/:id', arguments.callee);

  const id = parseInt(ctx.params.id);
  const { name, email } = ctx.req.body as any;

  if (!name || !email) {
    ctx.res.status = 400;
    return ctx.json({ error: 'Name and email are required' });
  }

  return ctx.json({
    id,
    name,
    email,
    updatedAt: new Date().toISOString()
  });
});

app.delete('/api/users/:id', async (ctx) => {
  addRouteToDevTools('DELETE', '/api/users/:id', arguments.callee);

  const id = parseInt(ctx.params.id);

  // Simulate some users that can't be deleted
  if (id === 1) {
    ctx.res.status = 403;
    return ctx.json({ error: 'Cannot delete admin user' });
  }

  return ctx.json({ message: 'User deleted successfully' });
});

// Posts API
app.get('/api/posts', async (ctx) => {
  addRouteToDevTools('GET', '/api/posts', arguments.callee);

  // Simulate database query with variable performance
  const delay = Math.random() * 500 + 100;
  await new Promise(resolve => setTimeout(resolve, delay));

  return ctx.json({
    posts: [
      { id: 1, title: 'Getting Started with OpenSpeed', author: 'John Doe', likes: 42 },
      { id: 2, title: 'Advanced Routing Techniques', author: 'Jane Smith', likes: 28 },
      { id: 3, title: 'Performance Optimization Tips', author: 'Bob Johnson', likes: 67 }
    ],
    total: 3
  });
});

app.post('/api/posts', async (ctx) => {
  addRouteToDevTools('POST', '/api/posts', arguments.callee);

  const { title, content, author } = ctx.req.body as any;

  if (!title || !content || !author) {
    ctx.res.status = 400;
    return ctx.json({ error: 'Title, content, and author are required' });
  }

  return ctx.json({
    id: Date.now(),
    title,
    content,
    author,
    likes: 0,
    createdAt: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', async (ctx) => {
  addRouteToDevTools('GET', '/health', arguments.callee);

  return ctx.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Simulate some errors for testing
app.get('/api/error/500', async (ctx) => {
  addRouteToDevTools('GET', '/api/error/500', arguments.callee);

  throw new Error('Simulated server error');
});

app.get('/api/error/404', async (ctx) => {
  addRouteToDevTools('GET', '/api/error/404', arguments.callee);

  ctx.res.status = 404;
  return ctx.json({ error: 'Resource not found' });
});

// Slow endpoint for performance testing
app.get('/api/slow', async (ctx) => {
  addRouteToDevTools('GET', '/api/slow', arguments.callee);

  // Simulate a very slow operation
  await new Promise(resolve => setTimeout(resolve, 2000));

  return ctx.json({
    message: 'This was a slow operation',
    processingTime: 2000
  });
});

// Static file serving example
app.get('/static/*', async (ctx) => {
  addRouteToDevTools('GET', '/static/*', arguments.callee);

  const path = ctx.req.url.replace('/static/', '');
  // In a real app, you'd serve actual files here
  return ctx.text(`Serving static file: ${path}`);
});

// WebSocket example (if supported)
app.get('/ws', async (ctx) => {
  addRouteToDevTools('GET', '/ws', arguments.callee);

  return ctx.text('WebSocket endpoint - upgrade to ws:// for real-time communication');
});

console.log('\n🚀 OpenSpeed DevTools Example Server');
console.log('📍 Routes: http://localhost:3000/_routes');
console.log('⚡ Performance: http://localhost:3000/_performance');
console.log('🛠️ DevTools Dashboard: http://localhost:3000/_devtools');
console.log('🌐 API: http://localhost:3000/api/users\n');

app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});