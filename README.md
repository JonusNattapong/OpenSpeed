<p align="center">
  <img src="./logo.png" width="500" alt="Openspeed Logo">
</p>

# Openspeed

A high-performance, developer-friendly web framework inspired by Hono and Elysia. Built for speed, extensibility, and excellent DX across multiple JavaScript runtimes.

Openspeed provides a modern, type-safe API with runtime-agnostic support for Node.js, Bun, and Deno. It features a powerful plugin system, advanced routing, and built-in optimizations for production applications.

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
- **⚛️ JSX Support**: React-like JSX rendering for HTML templating (like Hono)
- **📄 Static Site Generation**: Pre-render routes to static HTML files
- **🔗 RPC Type Safety**: End-to-end type safety without code generation (like Elysia)
- **🌊 Streaming Responses**: Generator functions, SSE, and NDJSON streaming
- **✅ Enhanced Validation**: Support for Zod, Valibot, ArkType, Effect via Standard Schema

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

### 🛠️ Development Tools
- **📍 Route Visualizer**: Interactive dashboard showing all API routes with methods, handlers, and middleware
- **⚡ Performance Monitor**: Real-time performance tracking with response times, error rates, and bottleneck detection
- **🎮 API Playground**: Test endpoints directly from the browser with custom headers and request bodies
- **📊 DevTools Dashboard**: Unified development interface combining all debugging and monitoring tools
- **🔍 Request Inspector**: Detailed request/response logging with timing and memory usage
- **🚨 Error Enhancement**: Developer-friendly error pages with actionable debugging information

### 🔒 Security Features
- **🛡️ CSRF Protection**: Token-based CSRF prevention with origin validation and constant-time comparison
- **💉 SQL Injection Prevention**: Parameterized query validator with forbidden pattern detection
- **🔐 XSS Protection**: Automatic HTML escaping with secure JSX rendering
- **🔑 Secure Authentication**: Bcrypt password hashing with configurable rounds (12+ recommended)
- **🍪 Secure Cookies**: HTTP-only, secure, and SameSite cookie configuration
- **📋 Input Validation**: Schema-based validation with Zod, Valibot, ArkType
- **🚦 Rate Limiting**: Brute force protection and DDoS mitigation
- **📁 File Upload Security**: MIME validation, size limits, and optional malware scanning
- **📊 Security Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **🔍 Security Scanner**: Automated vulnerability detection for common issues
- **🔧 Auto-Fixer**: Automated remediation for weak crypto, insecure cookies, and more
- **✅ Security Testing**: Comprehensive test suite covering OWASP Top 10

## 📦 Installation

Install Openspeed using your preferred package manager:

```bash
# npm
npm install openspeed

# pnpm
pnpm add openspeed

# yarn
yarn add openspeed

# bun
bun add openspeed
```

### Creating a New Project

Use the CLI tool to scaffold a new Openspeed project:

```bash
npx create-openspeed-app my-app
cd my-app
npm run dev
```

This creates a complete project structure with TypeScript, testing, and example routes.

For more details, see the [Getting Started Guide](https://github.com/JonusNattapong/OpenSpeed/tree/main/docs/guides/getting-started.md).

## 🚀 Quick Start

Here's a complete example showing Openspeed's core features:

```typescript
import { Openspeed } from 'openspeed';

const app = Openspeed();

// Basic routing with parameter extraction
app.get('/', (ctx) => ctx.text('Hello Openspeed!'));

app.get('/api/users/:id', (ctx) => {
  const userId = ctx.getParam('id');
  return ctx.json({
    id: userId,
    name: 'ElonDuck',
    timestamp: new Date().toISOString()
  });
});

// JSON handling with automatic parsing
app.post('/api/data', async (ctx) => {
  const data = ctx.getBody(); // Automatically parsed JSON
  return ctx.json({ received: data, success: true });
});

// File upload with multipart support
app.post('/upload', (ctx) => {
  const file = ctx.file;
  if (file) {
    return ctx.json({
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    });
  }
  return ctx.json({ error: 'No file uploaded' }, 400);
});

// Real-time WebSocket with room-based messaging
app.ws('/chat/:room', (ws, ctx) => {
  const room = ctx.getParam('room');
  ws.join(room);

  ws.on('message', (data) => {
    // Broadcast to all users in the room
    ws.broadcast(room, `User said: ${data}`);
  });

  ws.on('join', (newRoom) => {
    ws.leave(room);
    ws.join(newRoom);
  });
});

// Session management with secure cookies
app.get('/login', (ctx) => {
  ctx.setCookie('session', 'user123', {
    httpOnly: true,
    secure: true,
    maxAge: 86400 // 24 hours
  });
  return ctx.text('Logged in successfully!');
});

app.get('/profile', (ctx) => {
  const sessionId = ctx.getCookie('session');
  if (!sessionId) {
    return ctx.json({ error: 'Not authenticated' }, 401);
  }
  return ctx.json({ userId: sessionId, profile: 'User data' });
});

// Error handling with custom status codes
app.get('/error', (ctx) => {
  throw new Error('Something went wrong!');
});

// Start the server
app.listen(3000, () => {
  console.log('🚀 Openspeed server running on http://localhost:3000');
});
```

This example demonstrates routing, JSON handling, file uploads, WebSockets, cookies, and error handling. For more examples, see the [examples directory](https://github.com/JonusNattapong/OpenSpeed/tree/main/examples).

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

### Security Plugins

Comprehensive security features for production applications:

#### CSRF Protection

Prevent Cross-Site Request Forgery attacks:

```typescript
import { csrf, csrfToken, csrfInput } from 'openspeed/plugins';

app.use(csrf({
  secret: process.env.CSRF_SECRET,
  cookieName: '_csrf',
  headerName: 'x-csrf-token',
  enforceForMethods: ['POST', 'PUT', 'DELETE', 'PATCH']
}));

// In your form
app.get('/form', (ctx) => {
  const token = csrfToken(ctx);
  return ctx.html(`
    <form method="POST">
      <input type="hidden" name="csrf_token" value="${token}" />
      <button type="submit">Submit</button>
    </form>
  `);
});
```

#### SQL Injection Prevention

Validate SQL queries and parameters:

```typescript
import { validateSQL, sql } from 'openspeed/plugins';

// ❌ Vulnerable
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Safe
const { query, params } = sql(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);

// Or validate existing queries
validateSQL(query, params); // Throws if unsafe patterns detected
```

#### Input Validation

Schema-based validation with Zod:

```typescript
import { validate } from 'openspeed/plugins';
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  age: z.number().int().min(13)
});

app.post('/register',
  validate({ body: userSchema }),
  async (ctx) => {
    const data = ctx.req.body; // Typed and validated
    return ctx.json({ success: true });
  }
);
```

#### Security Headers

Comprehensive security headers:

```typescript
import { security } from 'openspeed/plugins';

app.use(security({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{random}'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  },
  noSniff: true,
  frameOptions: 'DENY'
}));
```

For more security features and best practices, see the [Security Guide](./docs/security/SECURITY_GUIDE.md).

## 🔒 Security Tools

Openspeed includes automated security tools:

```bash
# Scan for vulnerabilities
npm run security:scan

# Export detailed JSON report
npm run security:scan:json

# Auto-fix common security issues
npm run security:fix

# Preview fixes without applying
npm run security:fix:dry

# Check dependencies
npm audit
```

Read our [Security Policy](./SECURITY.md) for vulnerability reporting.

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

Openspeed includes comprehensive examples to demonstrate real-world usage patterns. All examples are available in the [examples directory](https://github.com/JonusNattapong/OpenSpeed/tree/main/examples).

### Hello World Example

A minimal setup showing basic routing and middleware:

```bash
cd examples/hello-openspeed
pnpm install
pnpm run dev
```

Features:
- Basic routing with parameters
- Middleware setup
- JSON responses
- Error handling

[View Source](https://github.com/JonusNattapong/OpenSpeed/tree/main/examples/hello-openspeed)

### ML-Optimized E-commerce API

A production-ready e-commerce application with advanced features:

```bash
cd examples/ml-optimized-api
pnpm install
pnpm run dev
```

Features:
- **User Management**: Registration, login, profiles
- **Product Catalog**: CRUD operations, search, categories
- **Shopping Cart**: Add/remove items, persistence
- **Order Processing**: Checkout flow, payment simulation
- **Analytics Dashboard**: Sales metrics, user behavior
- **ML Optimization**: Performance prediction, caching, anomaly detection
- **Database Integration**: PostgreSQL with connection pooling
- **Authentication**: JWT-based auth with role management

This example showcases Openspeed's enterprise capabilities and serves as a reference architecture.

[View Source](https://github.com/JonusNattapong/OpenSpeed/tree/main/examples/ml-optimized-api) | [API Documentation](https://github.com/JonusNattapong/OpenSpeed/blob/main/examples/ml-optimized-api/README.md)

### Running Examples

```bash
# Clone the repository
git clone https://github.com/JonusNattapong/OpenSpeed.git
cd OpenSpeed

# Install dependencies
pnpm install

# Run any example
cd examples/ml-optimized-api
pnpm run dev

# Visit http://localhost:3000 to see the API in action
```

For more examples and tutorials, check out our [documentation](https://github.com/JonusNattapong/OpenSpeed/tree/main/docs).

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

We welcome contributions to Openspeed! Whether you're fixing bugs, adding features, improving documentation, or helping with testing, your help is appreciated.

### 🚀 Getting Started

1. **Fork the repository** on [GitHub](https://github.com/JonusNattapong/OpenSpeed/fork)
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
- **Generate docs**: `pnpm run docs`

### 📝 Creating Custom Plugins

Openspeed's plugin system makes it easy to extend functionality. Here's how to create a custom plugin:

```typescript
import type { Context } from 'openspeed';

interface MyPluginOptions {
  config: string;
  enabled?: boolean;
}

function myPlugin(options: MyPluginOptions) {
  const { config, enabled = true } = options;

  return async (ctx: Context, next: () => Promise<any>) => {
    if (!enabled) return next();

    // Your middleware logic here
    console.log('Plugin config:', config);
    ctx.setHeader('X-Custom-Plugin', 'active');

    await next();

    // Post-processing logic
    console.log('Request completed');
  };
}

// Usage
app.use(myPlugin({ config: 'my-config', enabled: true }));
```

For more plugin examples, see the [plugins documentation](https://github.com/JonusNattapong/OpenSpeed/tree/main/docs/plugins).

### 🧪 Testing

- Add unit tests in `tests/` directory using Vitest
- Run tests with `pnpm test`
- Aim for high test coverage (>80%)
- Test both success and error scenarios

### 📋 Pull Request Process

1. **Update documentation** if needed (README, docs, examples)
2. **Add tests** for new features
3. **Ensure CI passes** (build, test, lint, typecheck)
4. **Create a Pull Request** with clear description:
   - What changes were made
   - Why they were needed
   - How to test the changes
5. **Wait for review** and address feedback

### 🎯 Code Style Guidelines

- **TypeScript**: Use TypeScript for all new code
- **Naming**: Follow camelCase for variables/functions, PascalCase for classes/types
- **Imports**: Group imports (external libs, then internal modules)
- **Error Handling**: Use proper error types and meaningful messages
- **Documentation**: Add JSDoc comments for public APIs
- **Commits**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)

### 📚 Documentation

- Update `README.md` for API changes
- Add examples in `examples/` directory
- Update plugin documentation in `docs/plugins/`
- Keep CHANGELOG.md up to date

### 🐛 Reporting Issues

Found a bug? Have a feature request?

- **Bug Reports**: Use [GitHub Issues](https://github.com/JonusNattapong/OpenSpeed/issues/new?template=bug_report.md)
- **Feature Requests**: Use [GitHub Discussions](https://github.com/JonusNattapong/OpenSpeed/discussions)
- **Security Issues**: Email maintainers directly

When reporting issues, please include:
- Clear reproduction steps
- Expected vs actual behavior
- Environment details (Node.js/Bun version, OS, Openspeed version)
- Code snippets or minimal reproduction repo

### 📞 Community

- **Discussions**: Join [GitHub Discussions](https://github.com/JonusNattapong/OpenSpeed/discussions) for questions and ideas
- **Issues**: Check [existing issues](https://github.com/JonusNattapong/OpenSpeed/issues) before creating new ones
- **Roadmap**: See our [future plans](https://github.com/JonusNattapong/OpenSpeed/blob/main/ROADMAP.md)

### 📋 Contributor License Agreement

By contributing to Openspeed, you agree that your contributions will be licensed under the same MIT license as the project.

Thank you for contributing to Openspeed! Your help makes the framework better for everyone. 🎉

## 📄 License

MIT License - see LICENSE file for details.

## 🎯 Goals

Openspeed aims to provide:

- **Performance**: Outperform existing frameworks
- **DX**: Excellent developer experience with tooling
- **Ecosystem**: Rich plugin ecosystem
- **Compatibility**: Work everywhere JavaScript runs

---

## 📖 Additional Resources

- **[Documentation](https://github.com/JonusNattapong/OpenSpeed/tree/main/docs)**: Comprehensive guides and API reference
- **[API Reference](https://github.com/JonusNattapong/OpenSpeed/tree/main/docs/api)**: Detailed API documentation
- **[Plugin Marketplace](https://github.com/JonusNattapong/OpenSpeed/tree/main/docs/plugins)**: Official and community plugins
- **[Migration Guide](https://github.com/JonusNattapong/OpenSpeed/blob/main/docs/guides/migration.md)**: Migrate from Express, Hono, or Elysia
- **[Performance Guide](https://github.com/JonusNattapong/OpenSpeed/blob/main/docs/guides/performance.md)**: Optimization tips and best practices

## 🆘 Support

- **Documentation**: [docs/](https://github.com/JonusNattapong/OpenSpeed/tree/main/docs)
- **Issues**: [GitHub Issues](https://github.com/JonusNattapong/OpenSpeed/issues)
- **Discussions**: [GitHub Discussions](https://github.com/JonusNattapong/OpenSpeed/discussions)
- **Discord**: Join our community (coming soon)

## 📄 License

Openspeed is [MIT licensed](https://github.com/JonusNattapong/OpenSpeed/blob/main/LICENSE).

---

Built with ❤️ for the modern web
