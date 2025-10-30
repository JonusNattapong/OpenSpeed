# OpenSpeed

A high-performance, developer-friendly web framework inspired by Hono and Elysia. Built for speed, extensibility, and excellent DX across multiple JavaScript runtimes.

## ✨ Features

- **🚀 High Performance**: Trie-based router with optimized middleware chaining
- **🔧 Runtime Agnostic**: Native support for Node.js, Bun, and Deno
- **🛠️ Rich Plugins**: Official plugins for CORS, logging, validation, OpenAPI, and more
- **📝 Type Safety**: Full TypeScript support with Zod validation
- **🧩 Extensible**: Plugin architecture for custom middleware
- **📊 Auto-Generated APIs**: OpenAPI spec generation from routes
- **⚡ Fast Development**: Hot reload and route introspection
- **🏗️ CLI Tooling**: Scaffold new projects instantly

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
import { createApp, cors, logger, json } from 'openspeed-framework';

const app = createApp();

app.use(cors());
app.use(logger());
app.use(json());

app.get('/', (ctx) => ctx.text('Hello OpenSpeed!'));

app.get('/api/users/:id', (ctx) => {
  return ctx.json({ id: ctx.params.id });
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

### CORS

```typescript
app.use(cors({ origin: '*', credentials: true }));
```

### Logger

```typescript
app.use(logger({ format: 'combined' }));
```

### JSON Parser

```typescript
app.use(json({ limit: '10mb' }));
```

### Error Handler

```typescript
app.use(errorHandler({ exposeStack: false }));
```

### Validation (with Zod)

```typescript
import { z } from 'zod';

app.get('/user/:id',
  validate({
    params: z.object({ id: z.string().min(1) }),
    query: z.object({ limit: z.number().optional() })
  }),
  (ctx) => ctx.json({ user: ctx.params.id })
);
```

### OpenAPI Generator

```typescript
const api = openapi({ title: 'My API', version: '1.0.0' });

app.use(api.middleware);
app.get('/users', (ctx) => ctx.json([]));
api.collect('GET', '/users', 'List all users');

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

*Benchmarks run with autocannon (100 concurrent connections, 10 seconds)*

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
