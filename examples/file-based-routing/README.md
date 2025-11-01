# OpenSpeed File-Based Routing Example

This example demonstrates OpenSpeed's powerful file-based routing system, inspired by Next.js App Router but optimized for high-performance backend APIs.

## 🚀 Features

- **Automatic Route Generation** - Routes are created automatically from your file structure
- **Dynamic Routes** - Support for `[param]` and `[...slug]` patterns
- **Nested Routes** - Organize routes in subdirectories
- **Route Groups** - Group routes without affecting URL structure
- **Layouts** - Shared middleware and response formatting
- **TypeScript Support** - Full type safety with auto-completion
- **Hot Reload** - Automatic route reloading in development

## 📁 Route Structure

```
routes/
├── index.ts              # GET /api/
├── users/
│   ├── _layout.ts        # Layout for all user routes
│   ├── index.ts          # GET /api/users, POST /api/users
│   ├── [id].ts           # GET /api/users/[id], PUT /api/users/[id], DELETE /api/users/[id]
│   └── [id]/
│       └── posts/
│           └── index.ts  # GET /api/users/[id]/posts, POST /api/users/[id]/posts
└── blog/
    └── [...slug].ts      # GET /api/blog/* (catch-all route)
```

## 🛠 Route Conventions

### Static Routes
```typescript
// routes/users/index.ts
export async function GET(ctx: Context) {
  return ctx.json({ users: [] });
}
```
Creates: `GET /api/users`

### Dynamic Routes
```typescript
// routes/users/[id].ts
export async function GET(ctx: Context) {
  const { id } = ctx.params;
  return ctx.json({ user: { id } });
}
```
Creates: `GET /api/users/:id`

### Catch-All Routes
```typescript
// routes/blog/[...slug].ts
export async function GET(ctx: Context) {
  const { slug } = ctx.params; // slug is string[]
  return ctx.json({ slug });
}
```
Creates: `GET /api/blog/*`

### Nested Routes
```typescript
// routes/users/[id]/posts/index.ts
export async function GET(ctx: Context) {
  const { id } = ctx.params;
  return ctx.json({ posts: [] });
}
```
Creates: `GET /api/users/:id/posts`

### Layouts
```typescript
// routes/users/_layout.ts
export async function middleware(ctx: Context, next: () => Promise<any>) {
  // Runs for all routes under /users/**
  console.log('User route accessed');
  return next();
}
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm

### Installation
```bash
cd examples/file-based-routing
pnpm install
```

### Running the Example
```bash
# Development mode (with hot reload)
pnpm dev

# Production mode
pnpm start
```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### Health & Info
- `GET /health` - Server health check
- `GET /api` - API information and available endpoints

### Users API
- `GET /api/users` - List all users (with pagination & filtering)
- `POST /api/users` - Create a new user
- `GET /api/users/[id]` - Get user by ID
- `PUT /api/users/[id]` - Update user by ID
- `DELETE /api/users/[id]` - Delete user by ID
- `GET /api/users/[id]/posts` - Get posts by user ID
- `POST /api/users/[id]/posts` - Create post for user

### Blog API
- `GET /api/blog` - List all blog posts
- `GET /api/blog/[slug]` - Get blog post by slug
- `GET /api/blog/[year]/[month]` - Get posts by year/month
- `GET /api/blog/[...slug]` - Catch-all for complex blog routes

## 💡 Usage Examples

### Creating a Simple Route
```typescript
// routes/hello.ts
import type { Context } from '../../src/openspeed/context.js';

export async function GET(ctx: Context) {
  return ctx.json({
    message: 'Hello from file-based routing!',
    timestamp: new Date().toISOString(),
  });
}
```

### Dynamic Route with Parameters
```typescript
// routes/products/[id].ts
import type { Context } from '../../src/openspeed/context.js';

export async function GET(ctx: Context) {
  const { id } = ctx.params;
  const productId = parseInt(id);

  return ctx.json({
    product: { id: productId, name: `Product ${productId}` },
  });
}

export async function PUT(ctx: Context) {
  const { id } = ctx.params;
  const body = await ctx.req.json();

  return ctx.json({
    product: { id, ...body },
    message: 'Product updated',
  });
}
```

### Catch-All Route
```typescript
// routes/docs/[...path].ts
import type { Context } from '../../src/openspeed/context.js';

export async function GET(ctx: Context) {
  const { path } = ctx.params; // path is string[]

  if (path.length === 0) {
    return ctx.json({ section: 'docs', page: 'index' });
  }

  if (path.length === 1) {
    return ctx.json({ section: 'docs', page: path[0] });
  }

  return ctx.json({
    section: 'docs',
    category: path[0],
    page: path.slice(1).join('/'),
  });
}
```

### Route with Layout
```typescript
// routes/api/_layout.ts
import type { Context } from '../../src/openspeed/context.js';

export async function middleware(ctx: Context, next: () => Promise<any>) {
  // Add API versioning
  ctx.set('apiVersion', 'v1');

  // Add request timing
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;

  // Add response metadata
  if (result && typeof result === 'object') {
    result._metadata = {
      apiVersion: ctx.get('apiVersion'),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };
  }

  return result;
}
```

## 🔧 Configuration

### App Setup
```typescript
import { createApp } from '../../src/openspeed/index.js';
import { fileRouting, watchRoutes } from '../../src/openspeed/plugins/fileRouting.js';

const app = createApp();

// Load routes from directory
await app.loadRoutes('./routes', {
  prefix: '/api',  // Optional: add prefix to all routes
});

// Watch for changes in development
if (process.env.NODE_ENV === 'development') {
  await watchRoutes('./routes', app, {
    basePath: '/api',
    hot: true,
  });
}

await app.listen(3000);
```

### Advanced Configuration
```typescript
await app.loadRoutes('./routes', {
  prefix: '/api/v1',
  extensions: ['.ts', '.js', '.mts'],
  conventions: {
    layout: '_layout',
    error: '_error',
    loading: '_loading',
    notFound: '_404',
  },
  cacheRoutes: true,
});
```

## 🎯 Best Practices

### File Organization
- Use `index.ts` for collection routes
- Group related routes in subdirectories
- Use `_layout.ts` for shared middleware
- Keep route files focused on a single responsibility

### Route Naming
- Use kebab-case for file names: `user-profile.ts`
- Use camelCase for dynamic parameters: `[userId].ts`
- Group routes logically by feature or resource

### Error Handling
```typescript
export async function GET(ctx: Context) {
  try {
    const data = await fetchData();
    return ctx.json({ data });
  } catch (error) {
    return ctx.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```

### Validation
```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(ctx: Context) {
  try {
    const body = await ctx.req.json();
    const validatedData = createUserSchema.parse(body);

    const user = await createUser(validatedData);
    return ctx.json(user, { status: 201 });
  } catch (error) {
    return ctx.json(
      { error: 'Invalid input', details: error.errors },
      { status: 400 }
    );
  }
}
```

## 🔍 Testing Routes

### Manual Testing
```bash
# Health check
curl http://localhost:3000/health

# List users
curl http://localhost:3000/api/users

# Get specific user
curl http://localhost:3000/api/users/1

# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'

# Blog catch-all
curl http://localhost:3000/api/blog/getting-started-with-openspeed
```

### Load Testing
```bash
# Install autocannon globally
npm install -g autocannon

# Test user listing endpoint
autocannon -c 100 -d 10 http://localhost:3000/api/users

# Test dynamic route
autocannon -c 50 -d 10 http://localhost:3000/api/users/1
```

## 🚀 Production Deployment

### Build Process
```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

### Environment Variables
```bash
NODE_ENV=production
PORT=3000
```

## 📚 Learn More

- [OpenSpeed Documentation](https://openspeed.dev)
- [File-Based Routing Guide](https://openspeed.dev/docs/file-routing)
- [API Reference](https://openspeed.dev/api)
- [Examples Repository](https://github.com/JonusNattapong/OpenSpeed/tree/main/examples)

## 🤝 Contributing

Found a bug or want to improve file-based routing? Check out our [contributing guide](https://github.com/JonusNattapong/OpenSpeed/blob/main/CONTRIBUTING.md).

---

Built with ❤️ using OpenSpeed's file-based routing system.