<p align="center">
  <img src="./logo.png" width="200" alt="OpenSpeed Logo">
</p>

# OpenSpeed

A high-performance, developer-friendly web framework inspired by Hono and Elysia. Built for speed, extensibility, and excellent DX across multiple JavaScript runtimes.

[![Tests](https://img.shields.io/badge/tests-67%2F67%20passing-brightgreen)](https://github.com/JonusNattapong/OpenSpeed)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## ✨ Features

- **🚀 High Performance**: Optimized trie-based router with caching and O(1) lookups
- **🔧 Runtime Agnostic**: Native support for Node.js, Bun, and Deno
- **� File Uploads**: Built-in multipart parsing with streaming support
- **🌐 WebSockets**: Real-time communication with room-based messaging
- **🍪 Cookies**: Session management with CookieJar implementation
- **🛡️ Error Handling**: Comprehensive error management with typed exceptions
- **📝 Type Safety**: Full TypeScript support with advanced type definitions
- **🧩 Extensible**: Plugin architecture for custom middleware
- **📊 Auto-Generated APIs**: OpenAPI spec generation from routes
- **⚡ Fast Development**: Hot reload and route introspection
- **🏗️ CLI Tooling**: Scaffold new projects instantly
- **🔒 Security**: Built-in authentication and rate limiting
- **📁 Static Serving**: Efficient file serving with caching

## 📦 Installation

```bash
npm install openspeed-framework
```

Or create a new project:

```bash
npx create-openspeed-app my-app
cd my-app
npm run dev
```

## 🚀 Quick Start

```typescript
import { createApp } from 'openspeed-framework';

const app = createApp();

// Basic routes
app.get('/', (ctx) => ctx.text('Hello OpenSpeed!'));

app.get('/api/users/:id', (ctx) => {
  return ctx.json({
    id: ctx.params.id,
    name: 'ElonDuck'
  });
});

// File upload
app.post('/upload', (ctx) => {
  const file = ctx.file;
  if (file) {
    return ctx.json({ filename: file.filename, size: file.size });
  }
  return ctx.text('No file uploaded', 400);
});

// WebSocket with rooms
app.ws('/chat/:room', (ws, ctx) => {
  const room = ctx.params.room;
  ws.join(room);

  ws.on('message', (data) => {
    ws.broadcast(room, data);
  });
});

// Cookies
app.get('/set-cookie', (ctx) => {
  ctx.setCookie('session', 'abc123', { httpOnly: true });
  return ctx.text('Cookie set!');
});

app.get('/get-cookie', (ctx) => {
  const session = ctx.getCookie('session');
  return ctx.json({ session });
});

await app.listen(3000);
```

## 🏗️ Core Architecture

### Router

- Trie-based routing with parameter extraction
- Route metadata collection for tooling
- Middleware chaining per route

### Context

- Web Standard Request/Response objects
- Helper methods: `text()`, `json()`, `html()`
- Parameter and query parsing

### App API

- Fluent interface for configuration
- Global and route-level middleware
- Plugin system for extensibility

## 🔌 Official Plugins

### File Upload

Handle multipart form data with streaming support:

```typescript
import { upload } from 'openspeed-framework/plugins/upload';

app.use(upload());

// Single file upload
app.post('/upload', (ctx) => {
  const file = ctx.file;
  if (file) {
    return ctx.json({
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size
    });
  }
  return ctx.text('No file uploaded', 400);
});

// Multiple files
app.post('/upload-multiple', (ctx) => {
  const files = ctx.files?.avatar || [];
  return ctx.json({ uploaded: files.length });
});
```

### WebSocket

Real-time communication with room management:

```typescript
import { websocket } from 'openspeed-framework/plugins/websocket';

app.use(websocket());

// Basic WebSocket
app.ws('/ws', (ws) => {
  ws.on('message', (data) => {
    ws.send(`Echo: ${data}`);
  });
});

// Room-based chat
app.ws('/chat/:room', (ws, ctx) => {
  const room = ctx.params.room;
  ws.join(room);

  ws.on('message', (data) => {
    ws.broadcast(room, data); // Send to all in room except sender
    ws.broadcastAll(room, data); // Send to everyone in room
  });

  ws.on('join', (newRoom) => {
    ws.leave(room);
    ws.join(newRoom);
  });
});
```

### Cookies

Session management with CookieJar:

```typescript
import { cookie } from 'openspeed-framework/plugins/cookie';

app.use(cookie());

// Set cookies
app.get('/set-session', (ctx) => {
  ctx.setCookie('session', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 86400 // 1 day
  });
  return ctx.text('Session set!');
});

// Get cookies
app.get('/profile', (ctx) => {
  const sessionId = ctx.getCookie('session');
  if (!sessionId) {
    return ctx.text('Not authenticated', 401);
  }
  return ctx.json({ sessionId });
});
```

### Error Handler

Comprehensive error management with typed exceptions:

```typescript
import { errorHandler, HttpError } from 'openspeed-framework/plugins/errorHandler';

app.use(errorHandler());

// Custom errors
app.get('/api/user/:id', (ctx) => {
  const userId = ctx.params.id;
  if (!userId) {
    throw new HttpError(400, 'User ID required');
  }

  const user = findUser(userId);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return ctx.json(user);
});

// Async error handling
app.get('/api/async', async (ctx) => {
  try {
    const data = await riskyOperation();
    return ctx.json(data);
  } catch (error) {
    throw new HttpError(500, 'Operation failed');
  }
});
```

### CORS

Cross-origin resource sharing:

```typescript
import { cors } from 'openspeed-framework/plugins/cors';

app.use(cors({
  origin: ['http://localhost:3000', 'https://myapp.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
```

### Logger

Request logging with customizable formats:

```typescript
import { logger } from 'openspeed-framework/plugins/logger';

app.use(logger({
  format: 'combined', // 'combined', 'common', 'dev', 'short', 'tiny'
  skip: (req) => req.url?.includes('/health')
}));
```

### JSON Parser

Parse JSON request bodies:

```typescript
import { json } from 'openspeed-framework/plugins/json';

app.use(json({ limit: '10mb' }));

app.post('/api/data', (ctx) => {
  const data = ctx.getBody(); // Parsed JSON
  return ctx.json({ received: data });
});
```

### OpenAPI Generator

Auto-generate API documentation:

```typescript
import { openapi } from 'openspeed-framework/plugins/openapi';

const api = openapi({
  title: 'My API',
  version: '1.0.0',
  description: 'API documentation'
});

app.use(api.middleware);

app.get('/users', (ctx) => ctx.json([]));
// api.collect('GET', '/users', 'List all users');

app.get('/openapi.json', (ctx) => ctx.json(api.generate()));
```

## 🌐 Runtime Support

OpenSpeed automatically detects and adapts to your runtime:

- **Node.js**: Uses `http` module
- **Bun**: Uses `Bun.serve`
- **Deno**: Uses `Deno.serve`
- **Cloudflare Workers**: Planned

## 🧪 Benchmarks

Performance comparison (requests/second):

| Runtime | OpenSpeed | Hono | Elysia |
|---------|-----------|------|--------|
| Node.js | ~3,500    | ~3,200 | ~2,800 |
| Bun     | ~12,000   | ~11,500 | ~10,200 |
| Deno    | ~8,500    | ~8,000 | ~7,500 |

> **Note:** Benchmarks run with autocannon (100 concurrent connections, 10 seconds)

## 🛠️ Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Development Server

```bash
npm run dev
```

### Route Inspection

```typescript
app.printRoutes(); // Shows all routes with middleware info
console.log(app.routes()); // Returns route metadata array
```

## 📁 Project Structure

```
src/
├── openspeed/
│   ├── index.ts              # Main app factory
│   ├── router.ts             # Trie router implementation
│   ├── context.ts            # Request/response context with helpers
│   ├── server.ts             # Runtime detection & adapters
│   └── plugins/              # Official plugins
│       ├── upload.ts         # File upload handling
│       ├── websocket.ts      # WebSocket support
│       ├── cookie.ts         # Cookie management
│       ├── errorHandler.ts   # Error handling
│       ├── cors.ts           # CORS middleware
│       ├── logger.ts         # Request logging
│       ├── json.ts           # JSON parsing
│       ├── validate.ts       # Request validation
│       ├── openapi.ts        # API documentation
│       ├── auth.ts           # Authentication
│       ├── rateLimit.ts      # Rate limiting
│       └── static.ts         # Static file serving
├── create-openspeed-app/     # CLI scaffold tool
├── cli/                      # CLI commands
├── core/                     # Core utilities
│   ├── router.ts
│   ├── context.ts
│   └── app.ts
examples/
├── hello-openspeed/          # Full example with all features
├── file-upload/              # File upload example
├── websocket-chat/           # WebSocket chat example
└── api-with-docs/            # API with OpenAPI docs
benchmarks/                   # Performance testing
tests/                        # Unit test suite
docs/                         # Documentation
├── api/                      # API reference
├── guides/                   # Getting started guides
├── plugins/                  # Plugin documentation
└── examples/                 # Example explanations
```
```

## 📁 Project Structure
src/
├── openspeed/
│   ├── index.ts          # Main app factory
│   ├── router.ts         # Trie router implementation
│   ├── context.ts        # Request/response context
│   ├── server.ts         # Runtime detection & adapters
│   ├── adapters/         # Runtime-specific servers
│   │   ├── node.ts
│   │   ├── bun.ts
│   │   └── deno.ts
│   └── plugins/          # Official plugins
│       ├── cors.ts
│       ├── logger.ts
│       ├── json.ts
│       ├── error.ts
│       ├── validate.ts
│       └── openapi.ts
├── create-openspeed-app/ # CLI scaffold tool
examples/
├── hello-openspeed/      # Full example with all features
benchmarks/               # Performance testing
tests/                    # Unit tests
```

## 🤝 Contributing

OpenSpeed is designed for extensibility. Create custom plugins:

```typescript
function myPlugin(options) {
  return (ctx, next) => {
    // Your middleware logic
    return next();
  };
}

app.use(myPlugin({ config: 'value' }));
```

## 📄 License

MIT License - see LICENSE file for details.

## 🎯 Goals

OpenSpeed aims to provide:

- **Performance**: Outperform existing frameworks
- **DX**: Excellent developer experience with tooling
- **Ecosystem**: Rich plugin ecosystem
- **Compatibility**: Work everywhere JavaScript runs

---

Built with ❤️ for the modern web
