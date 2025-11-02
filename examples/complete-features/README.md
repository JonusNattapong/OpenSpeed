# OpenSpeed Complete Features Example

This example demonstrates **all the new features** added to OpenSpeed to achieve feature parity with Hono and Elysia, including:

- ✅ **JSX Rendering** - React-like JSX support for HTML templating
- ✅ **Static Site Generation (SSG)** - Pre-render routes to static HTML
- ✅ **RPC with Type Safety** - End-to-end type safety like tRPC/Eden
- ✅ **Streaming Responses** - Generator functions and Server-Sent Events
- ✅ **Enhanced Validation** - Support for Zod, Valibot, ArkType, and more

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd examples/complete-features
npm install
```

### 2. Build the Project

```bash
cd ../..  # Go back to root
npm run build
```

### 3. Run the Server

```bash
# From root directory
npm run dev
# Or directly:
tsx examples/complete-features/index.ts
```

### 4. Open in Browser

Visit http://localhost:3000 to see all features in action.

## 📚 Features Demonstrated

### 1. JSX Rendering (like Hono)

OpenSpeed now supports JSX rendering similar to Hono:

```typescript
import { jsx, Layout, H1, P } from 'openspeed/plugins/jsx';

app.get('/', (ctx) => {
  return ctx.jsx(
    jsx(Layout, { title: 'Home' },
      jsx(H1, {}, 'Welcome to OpenSpeed!'),
      jsx(P, {}, 'Fast and ergonomic framework')
    )
  );
});
```

**Routes demonstrating JSX:**
- `GET /` - Home page with JSX
- `GET /jsx-demo` - JSX rendering demo
- `GET /about` - About page
- `GET /docs` - Documentation page

### 2. Static Site Generation (SSG)

Pre-render routes to static HTML files for better performance and SEO:

```typescript
import { ssg, generateStatic, defineRoutes } from 'openspeed/plugins/ssg';

app.use(ssg({
  outputDir: './dist',
  routes: defineRoutes(['/', '/about', '/docs'])
}));

// Generate static site
await generateStatic(app, routes, {
  outputDir: './build',
  cleanOutputDir: true
});
```

**Generate static site:**

```bash
npm run build
tsx examples/complete-features/generate-ssg.ts
```

Output will be in `examples/complete-features/dist/`

### 3. RPC with End-to-End Type Safety (like Elysia)

Type-safe API calls without code generation:

**Server:**
```typescript
import { rpc, defineRoute } from 'openspeed/plugins/rpc';

app.use(rpc());

app.post('/api/users', defineRoute<UserInput, UserOutput>((ctx) => {
  const user = ctx.body;
  return ctx.json({ id: '123', ...user });
}));

export type App = typeof app;
```

**Client:**
```typescript
import { treaty } from 'openspeed/plugins/rpc';
import type { App } from './server';

const api = treaty<App>('http://localhost:3000');

const { data, error } = await api['/api/users'].post({
  body: { name: 'Alice', email: 'alice@example.com', age: 28 }
});

if (data) {
  console.log(data.id); // Type-safe!
}
```

**Run RPC client example:**

```bash
# Start server first
tsx examples/complete-features/index.ts

# In another terminal, run client
tsx examples/complete-features/client.ts
```

### 4. Streaming Responses

Support for streaming using generators and Server-Sent Events:

**Basic Streaming:**
```typescript
import { stream } from 'openspeed/plugins/stream';

app.use(stream());

app.get('/stream', (ctx) => {
  return ctx.stream(async function* () {
    yield 'Hello ';
    await new Promise(r => setTimeout(r, 500));
    yield 'World!';
  }());
});
```

**Server-Sent Events (SSE):**
```typescript
app.get('/events', (ctx) => {
  return ctx.streamSSE(async function* () {
    let count = 0;
    while (count < 10) {
      yield { data: { count, timestamp: Date.now() } };
      await new Promise(r => setTimeout(r, 1000));
      count++;
    }
  }());
});
```

**Routes demonstrating streaming:**
- `GET /stream-demo` - Basic text streaming
- `GET /sse-demo` - Server-Sent Events demo
- `GET /stream-json` - JSON streaming (NDJSON)
- `GET /stream-advanced` - Advanced streaming with transformations

### 5. Enhanced Validation (Zod, Valibot, ArkType, Effect)

Support for multiple validators via Standard Schema:

**With Zod:**
```typescript
import { validate } from 'openspeed/plugins/validate';
import { z } from 'zod';

app.post('/api/users', validate({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    age: z.number().int().min(18)
  })
}), (ctx) => {
  const user = ctx.getBody(); // Type-safe and validated!
  return ctx.json(user);
});
```

**With Valibot:**
```typescript
import * as v from 'valibot';

app.post('/api/users', validate({
  body: v.object({
    name: v.string(),
    email: v.string([v.email()]),
    age: v.number([v.integer(), v.minValue(18)])
  })
}), handler);
```

**Routes demonstrating validation:**
- `POST /api/users` - User creation with Zod validation
- `POST /api/validated` - Enhanced validation demo
- `GET /api/search` - Query parameter validation

## 🧪 Testing the Features

### Test JSX Rendering

```bash
curl http://localhost:3000/
curl http://localhost:3000/jsx-demo
```

### Test Streaming

```bash
curl http://localhost:3000/stream-demo
curl -N http://localhost:3000/sse-demo  # -N for no buffer
curl http://localhost:3000/stream-json
```

### Test RPC API

```bash
# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","age":28}'

# Get user
curl http://localhost:3000/api/users/123

# Search with validation
curl "http://localhost:3000/api/search?q=openspeed&limit=10"
```

### Test Validation Errors

```bash
# This should fail validation (age < 18)
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com","age":15}'
```

## 📁 File Structure

```
examples/complete-features/
├── README.md              # This file
├── index.ts               # Main server with all features
├── client.ts              # RPC client example
├── generate-ssg.ts        # SSG generation script
├── package.json           # Dependencies
└── dist/                  # Generated static files (after SSG)
    ├── index.html
    ├── about.html
    ├── docs.html
    ├── sitemap.xml
    └── robots.txt
```

## 🎯 Available Routes

### JSX Routes
- `GET /` - Home page
- `GET /jsx-demo` - JSX demonstration
- `GET /about` - About page (SSG ready)
- `GET /docs` - Documentation (SSG ready)

### Streaming Routes
- `GET /stream-demo` - Basic streaming
- `GET /sse-demo` - Server-Sent Events
- `GET /stream-json` - JSON streaming
- `GET /stream-advanced` - Advanced streaming with filters

### API Routes (RPC + Validation)
- `POST /api/users` - Create user (Zod validation)
- `GET /api/users/:id` - Get user by ID
- `POST /api/validated` - Validation demo
- `POST /api/batch` - Batch requests
- `GET /api/products` - Products list
- `GET /api/search` - Search with query validation

### Utility Routes
- `GET /health` - Health check
- `GET /api/status` - Server status
- `GET /__rpc/introspect` - RPC route introspection

## 🔧 Scripts

```bash
# Build the project
npm run build

# Run development server
npm run dev

# Generate static site
tsx examples/complete-features/generate-ssg.ts

# Run RPC client example
tsx examples/complete-features/client.ts
```

## 📖 Documentation

For more information about each feature:

- **JSX**: See `src/openspeed/plugins/jsx.ts`
- **SSG**: See `src/openspeed/plugins/ssg.ts`
- **RPC**: See `src/openspeed/plugins/rpc.ts`
- **Streaming**: See `src/openspeed/plugins/stream.ts`
- **Validation**: See `src/openspeed/plugins/validate.ts`

## 🚀 What's New?

These features bring OpenSpeed to **feature parity** with Hono and Elysia:

### From Hono:
✅ JSX rendering support
✅ Static Site Generation (SSG)
✅ Multiple routers (already had trie-based)
✅ RPC mode with type safety
✅ Streaming helpers

### From Elysia:
✅ End-to-end type safety (treaty client)
✅ Multiple validator support (Standard Schema)
✅ OpenAPI integration (already had)
✅ Streaming with generators
✅ Type-safe testing utilities

### Additional Improvements:
✅ Enhanced validation with Standard Schema
✅ Server-Sent Events (SSE)
✅ NDJSON streaming
✅ Batch requests
✅ Custom error handlers
✅ Request/Response hooks

## 💡 Tips

1. **Use JSX for HTML**: Replace string templates with type-safe JSX
2. **Pre-render with SSG**: Generate static pages for better performance
3. **Type-safe APIs**: Use RPC client for full type safety
4. **Stream large data**: Use generators for efficient memory usage
5. **Validate everything**: Use Zod or your favorite validator

## 🤝 Contributing

Found a bug or have a suggestion? Please open an issue!

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for the modern web