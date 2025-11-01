<p align="center">
  <img src="./logo.png" width="500" alt="OpenSpeed Logo">
</p>

# Openspeed

A high-performance, developer-friendly web framework inspired by Hono and Elysia. Built for speed, extensibility, and excellent DX across multiple JavaScript runtimes.

[![npm version](https://img.shields.io/npm/v/openspeed.svg)](https://www.npmjs.com/package/openspeed)
[![Tests](https://img.shields.io/badge/tests-102%2F102%20passing-brightgreen)](https://github.com/JonusNattapong/OpenSpeed)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/JonusNattapong/OpenSpeed.svg)](https://github.com/JonusNattapong/OpenSpeed/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/JonusNattapong/OpenSpeed.svg)](https://github.com/JonusNattapong/OpenSpeed/issues)

## ✨ Features

### Core Features
- **🚀 High Performance**: Optimized trie-based router with caching and O(1) lookups
- **🔧 Runtime Agnostic**: Native support for Node.js, Bun, and Deno
- **📁 File Uploads**: Built-in multipart parsing with streaming support
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

### 🌟 Advanced Features (NEW!)
- **📂 File-based Routing**: Next.js-style automatic route generation from file structure
- **💾 Database Adapters**: Type-safe MongoDB, MySQL, PostgreSQL, Redis with connection pooling
- **👥 Multi-tenancy**: Database isolation per tenant with automatic context switching
- **🔐 RBAC**: Role-Based Access Control with hierarchical permissions
- **📝 Audit Logging**: SOC 2, GDPR, HIPAA, PCI-DSS compliance support
- **☸️ Kubernetes**: Auto-scaling operators with HPA and custom metrics
- **🧠 AI-Powered Optimization**: ML-based request prediction and adaptive performance tuning
- **⚡ Advanced Caching**: Intelligent query coalescing, batching, and bloom filters
- **🚀 Zero-Copy Streaming**: Memory-efficient large payload handling
- **🎯 Object Pooling**: High-frequency object reuse for optimal performance

## 📦 Installation

```bash
npm install openspeed
```

Or create a new project:

```bash
npx create-openspeed-app my-app
cd my-app
npm run dev
```

## 🚀 Quick Start

```typescript
import { Openspeed } from 'openspeed';

const app = Openspeed();

// Basic routes
app.get('/', (ctx) => ctx.text('Hello Openspeed'));

app.get('/api/users/:id', (ctx) => {
  return ctx.json({
    id: ctx.getParam('id'),
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
  const room = ctx.getParam('room');
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

app.listen(3000);
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
import { upload } from 'openspeed/plugins/upload';

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
import { websocket } from 'openspeed/plugins/websocket';

app.use(websocket());

// Basic WebSocket
app.ws('/ws', (ws) => {
  ws.on('message', (data) => {
    ws.send(`Echo: ${data}`);
  });
});

// Room-based chat
app.ws('/chat/:room', (ws, ctx) => {
  const room = ctx.getParam('room');
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
import { cookie } from 'openspeed/plugins/cookie';

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
import { errorHandler, HttpError } from 'openspeed/plugins/errorHandler';

app.use(errorHandler());

// Custom errors
app.get('/api/user/:id', (ctx) => {
  const userId = ctx.getParam('id');
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
import { cors } from 'openspeed/plugins/cors';

app.use(cors({
  origin: ['http://localhost:3000', 'https://myapp.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
```

### Logger

Request logging with customizable formats:

```typescript
import { logger } from 'openspeed/plugins/logger';

app.use(logger({
  format: 'combined', // 'combined', 'common', 'dev', 'short', 'tiny'
  skip: (req) => req.url?.includes('/health')
}));
```

### JSON Parser

Parse JSON request bodies:

```typescript
import { json } from 'openspeed/plugins/json';

app.use(json({ limit: '10mb' }));

app.post('/api/data', (ctx) => {
  const data = ctx.getBody(); // Parsed JSON
  return ctx.json({ received: data });
});
```

### OpenAPI Generator

Auto-generate API documentation:

```typescript
import { openapi } from 'openspeed/plugins/openapi';

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

Openspeed automatically detects and adapts to your runtime:

- **Node.js**: Uses `http` module
- **Bun**: Uses `Bun.serve`
- **Deno**: Uses `Deno.serve`
- **Cloudflare Workers**: Planned

## 🧪 Benchmarks

Performance comparison (requests/second):

| Runtime | Openspeed | Hono | Elysia |
|---------|-----------|------|--------|
| Node.js | ~7,000*   | ~3,200 | ~2,800 |
| Bun     | ~24,000*  | ~11,500 | ~10,200 |
| Deno    | ~17,000*  | ~8,000 | ~7,500 |

> **Note:** Benchmarks run with autocannon (100 concurrent connections, 10 seconds)
> *With adaptive optimizer enabled - 2x-3x faster than competition!

### Running Benchmarks

Compare Openspeed with Hono and Elysia across different scenarios:

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run comprehensive benchmarks (Node.js)
pnpm run bench:node

# Run comprehensive benchmarks (Bun)
pnpm run bench:bun

# Run specific benchmark scenario
cd benchmarks
bun run apps/openspeed-routing.ts 3000 &
autocannon -c 100 -d 10 http://localhost:3000/
```

Available benchmark scenarios:
- **routing**: Basic routing performance
- **json**: JSON parsing and response
- **middleware**: Middleware chaining
- **plugins**: Plugin performance
- **real-world**: Full application simulation

## 🛠️ Development

### Running Tests

```bash
pnpm test
```

### Building

```bash
pnpm run build
```

### Development Server

```bash
pnpm run dev
```

### Route Inspection

```typescript
app.printRoutes(); // Shows all routes with middleware info
console.log(app.routes()); // Returns route metadata array
```

## 📚 Examples

Openspeed comes with several examples to help you get started:

### Hello World

Basic setup with routing and middleware:

```bash
cd examples/hello-openspeed
pnpm install
pnpm run dev
```

### ML-Optimized E-commerce API

Full-featured e-commerce API with ML optimization:

```bash
cd examples/ml-optimized-api
pnpm install
pnpm run dev
```

Features:
- User authentication and registration
- Product catalog with search
- Shopping cart and checkout
- Order management
- Analytics dashboard
- ML-powered performance optimization

### Running Examples

```bash
# Clone the repo
git clone https://github.com/JonusNattapong/OpenSpeed.git
cd OpenSpeed

# Install dependencies
pnpm install

# Run any example
cd examples/ml-optimized-api
pnpm run dev
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
│       ├── adaptiveOptimizer.ts  # ML-powered optimization
│       ├── auditLog.ts       # Audit logging
│       ├── auth.ts           # Authentication
│       ├── circuitBreaker.ts # Circuit breaker pattern
│       ├── codegen.ts        # Code generation
│       ├── compression.ts    # Response compression
│       ├── cookie.ts         # Cookie management
│       ├── cors.ts           # CORS middleware
│       ├── database.ts       # Database adapters
│       ├── dashboard.ts      # Admin dashboard
│       ├── email.ts          # Email service
│       ├── errorHandler.ts   # Error handling
│       ├── fileRouting.ts    # File-based routing
│       ├── graphql.ts        # GraphQL support
│       ├── hotReload.ts      # Hot reload
│       ├── index.ts          # Plugin exports
│       ├── json.ts           # JSON parsing
│       ├── kubernetes.ts     # Kubernetes operators
│       ├── loadBalancer.ts   # Load balancing
│       ├── logger.ts         # Request logging
│       ├── memory.ts         # Memory management
│       ├── metrics.ts        # Metrics collection
│       ├── mlOptimizer.ts    # ML optimization (legacy)
│       ├── openapi.ts        # API documentation
│       ├── playground.ts     # Development playground
│       ├── rateLimit.ts      # Rate limiting
│       ├── rbac.ts           # Role-based access control
│       ├── static.ts         # Static file serving
│       ├── storage.ts        # File storage
│       ├── stripe.ts         # Stripe payment
│       ├── tracing.ts        # Request tracing
│       ├── twilio.ts         # SMS service
│       ├── upload.ts         # File upload handling
│       ├── validate.ts       # Request validation
│       └── websocket.ts      # WebSocket support
├── cli/                      # CLI commands
├── create-openspeed-app/     # CLI scaffold tool
examples/
├── ml-optimized-api/         # Full e-commerce API with ML optimization
benchmarks/                   # Performance testing
├── apps/                     # Benchmark applications
│   ├── openspeed-*.ts        # Openspeed benchmarks
│   ├── hono-*.ts             # Hono benchmarks
│   └── elysia-*.ts           # Elysia benchmarks
├── run-comprehensive.ts      # Comprehensive benchmark runner
├── tsconfig.benchmark.json   # Benchmark TypeScript config
tests/                        # Unit test suite
├── plugins/                  # Plugin tests
docs/                         # Documentation
├── plugins/                  # Plugin documentation
apps/                         # Application templates
packages/                     # Monorepo packages
```
```

## 📁 Project Structure
src/
├── openspeed/
│   ├── index.ts          # Main app factory
│   ├── router.ts         # Trie router implementation
│   ├── context.ts        # Request/response context
│   ├── server.ts         # Runtime detection & adapters
│   └── plugins/          # Official plugins (see above)
├── cli/                  # CLI commands
├── create-openspeed-app/ # CLI scaffold tool
examples/
├── ml-optimized-api/     # Full e-commerce API with ML optimization
benchmarks/               # Performance testing (see above)
tests/                    # Unit tests
docs/                     # Documentation
apps/                     # Application templates
packages/                 # Monorepo packages
```

## 🤝 Contributing

We welcome contributions to Openspeed! Here's how you can help:

### 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/OpenSpeed.git
   cd OpenSpeed
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### 🛠️ Development Workflow

- **Build the project**: `pnpm run build`
- **Run tests**: `pnpm test`
- **Run benchmarks**: `pnpm run bench:node` or `pnpm run bench:bun`
- **Lint code**: `pnpm run lint`
- **Format code**: `pnpm run format`

### 📝 Creating Custom Plugins

Openspeed is designed for extensibility. Create custom plugins:

```typescript
function myPlugin(options: { config: string }) {
  return (ctx: Context, next: () => Promise<any>) => {
    // Your middleware logic
    console.log('Plugin config:', options.config);
    return next();
  };
}

app.use(myPlugin({ config: 'value' }));
```

### 🧪 Testing

- Add unit tests in `tests/` directory
- Run tests with `pnpm test`
- Aim for high test coverage

### 📋 Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Ensure CI passes** (build, test, lint)
4. **Create a Pull Request** with clear description
5. **Wait for review** and address feedback

### 🎯 Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Run `pnpm run lint` and `pnpm run format` before committing
- Use meaningful commit messages

### 📚 Documentation

- Update README.md for API changes
- Add examples in `examples/` directory
- Update plugin documentation in `docs/plugins/`

### 🐛 Reporting Issues

- Use GitHub Issues for bugs and feature requests
- Provide clear reproduction steps
- Include environment details (Node.js/Bun version, OS)

### 📞 Community

- Join discussions on GitHub Issues
- Follow the project for updates

Thank you for contributing to Openspeed! 🎉

## 📄 License

MIT License - see LICENSE file for details.

## 🎯 Goals

Openspeed aims to provide:

- **Performance**: Outperform existing frameworks
- **DX**: Excellent developer experience with tooling
- **Ecosystem**: Rich plugin ecosystem
- **Compatibility**: Work everywhere JavaScript runs

---

Built with ❤️ for the modern web
