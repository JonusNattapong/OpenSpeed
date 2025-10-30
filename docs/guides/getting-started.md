# Getting Started with OpenSpeed

Welcome to OpenSpeed! This guide will help you get started with building web applications using the framework.

## Installation

### Option 1: Create a new project

```bash
npx create-openspeed-app my-app
cd my-app
npm run dev
```

### Option 2: Add to existing project

```bash
npm install openspeed-framework
```

## Your First Application

Create a file called `server.ts`:

```typescript
import { createApp } from 'openspeed-framework';

const app = createApp();

// Basic route
app.get('/', (ctx) => {
  return ctx.text('Hello, OpenSpeed!');
});

// JSON API
app.get('/api/health', (ctx) => {
  return ctx.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Route with parameters
app.get('/users/:id', (ctx) => {
  const userId = ctx.params.id;
  return ctx.json({
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`
  });
});

// Start the server
await app.listen(3000);
console.log('Server running at http://localhost:3000');
```

Run it:

```bash
# With Node.js
node server.ts

# With Bun
bun server.ts

# With Deno
deno run --allow-net server.ts
```

## Adding Middleware

OpenSpeed uses a plugin-based architecture. Here's how to add common middleware:

```typescript
import { createApp } from 'openspeed-framework';
import { logger } from 'openspeed-framework/plugins/logger';
import { cors } from 'openspeed-framework/plugins/cors';
import { json } from 'openspeed-framework/plugins/json';

const app = createApp();

// Add middleware
app.use(logger()); // Request logging
app.use(cors());   // CORS support
app.use(json());   // JSON body parsing

app.get('/api/data', (ctx) => {
  const body = ctx.getBody(); // Parsed JSON
  return ctx.json({ received: body });
});

await app.listen(3000);
```

## File Uploads

```typescript
import { createApp } from 'openspeed-framework';
import { upload } from 'openspeed-framework/plugins/upload';

const app = createApp();
app.use(upload());

// Single file upload
app.post('/upload', (ctx) => {
  const file = ctx.file;
  if (!file) {
    return ctx.text('No file uploaded', 400);
  }

  return ctx.json({
    filename: file.filename,
    size: file.size,
    mimetype: file.mimetype
  });
});

// Multiple files
app.post('/upload-multiple', (ctx) => {
  const files = ctx.files?.documents || [];
  return ctx.json({
    uploaded: files.length,
    files: files.map(f => ({ name: f.filename, size: f.size }))
  });
});

await app.listen(3000);
```

## WebSocket Support

```typescript
import { createApp } from 'openspeed-framework';
import { websocket } from 'openspeed-framework/plugins/websocket';

const app = createApp();
app.use(websocket());

// Basic WebSocket echo
app.ws('/echo', (ws) => {
  ws.on('message', (data) => {
    ws.send(`Echo: ${data}`);
  });
});

// Chat room
app.ws('/chat/:room', (ws, ctx) => {
  const room = ctx.params.room;
  ws.join(room);

  ws.on('message', (data) => {
    // Broadcast to all users in the room
    ws.broadcast(room, {
      user: 'Anonymous',
      message: data,
      timestamp: new Date().toISOString()
    });
  });

  ws.on('join', (newRoom) => {
    ws.leave(room);
    ws.join(newRoom);
    ws.send(`Joined room: ${newRoom}`);
  });
});

await app.listen(3000);
```

## Cookie Management

```typescript
import { createApp } from 'openspeed-framework';
import { cookie } from 'openspeed-framework/plugins/cookie';

const app = createApp();
app.use(cookie());

// Set a session cookie
app.get('/login', (ctx) => {
  ctx.setCookie('session', 'user123', {
    httpOnly: true,
    secure: true,
    maxAge: 86400 // 1 day
  });
  return ctx.json({ message: 'Logged in successfully' });
});

// Check authentication
app.get('/profile', (ctx) => {
  const sessionId = ctx.getCookie('session');
  if (!sessionId) {
    return ctx.json({ error: 'Not authenticated' }, 401);
  }

  return ctx.json({
    userId: sessionId,
    profile: { name: 'John Doe', email: 'john@example.com' }
  });
});

// Logout
app.get('/logout', (ctx) => {
  ctx.setCookie('session', '', { maxAge: 0 });
  return ctx.json({ message: 'Logged out' });
});

await app.listen(3000);
```

## Error Handling

```typescript
import { createApp } from 'openspeed-framework';
import { errorHandler, HttpError } from 'openspeed-framework/plugins/errorHandler';

const app = createApp();
app.use(errorHandler());

// Routes that might throw errors
app.get('/api/user/:id', (ctx) => {
  const userId = ctx.params.id;

  if (!userId) {
    throw new HttpError(400, 'User ID is required');
  }

  const user = findUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return ctx.json(user);
});

// Async error handling
app.get('/api/data', async (ctx) => {
  try {
    const data = await fetchExternalData();
    return ctx.json(data);
  } catch (error) {
    throw new HttpError(500, 'Failed to fetch data');
  }
});

await app.listen(3000);
```

## Next Steps

- Check out the [API Reference](../api.md) for detailed documentation
- Explore [Plugin Documentation](../plugins/) for more middleware options
- Look at [Examples](../../examples/) for complete applications
- Join our community for support and contributions

Happy coding with OpenSpeed! 🚀