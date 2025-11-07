---
layout: default
title: Advanced Features
nav_order: 11
---

# Advanced Features Guide

## File-Based Routing

OpenSpeed now supports Next.js-style file-based routing for automatic route generation.

### Directory Structure

```
app/
├── routes/
│   ├── index.ts                 # /
│   ├── about.ts                 # /about
│   ├── api/
│   │   ├── users/
│   │   │   ├── index.ts        # /api/users
│   │   │   ├── [id].ts         # /api/users/:id
│   │   │   └── [...slug].ts    # /api/users/* (catch-all)
│   │   └── posts.ts            # /api/posts
│   ├── (admin)/                # Route group (doesn't affect URL)
│   │   ├── users.ts            # /users
│   │   └── settings.ts         # /settings
│   └── _layout.ts              # Layout component
```

### Usage

```typescript
import { createApp } from 'openspeed-framework';
import { fileRouting } from 'openspeed-framework/plugins';

const app = createApp();

// Enable file-based routing
app.use(fileRouting({
  routesDir: './routes',
  basePath: '',
  extensions: ['.ts', '.js'],
  hot: true, // Enable hot reload
}));

await app.listen(3000);
```

### Route File Example

```typescript
// routes/api/users/[id].ts
import type { Context } from 'openspeed-framework';

// GET /api/users/:id
export const GET = async (ctx: Context) => {
  const userId = ctx.params.id;
  const user = await db.users.findById(userId);
  return ctx.json(user);
};

// PUT /api/users/:id
export const PUT = async (ctx: Context) => {
  const userId = ctx.params.id;
  const data = await ctx.getBody();
  const user = await db.users.update(userId, data);
  return ctx.json(user);
};

// Middleware for this route
export const middleware = [
  requireAuth,
  requirePermission('users', 'read')
];

// Metadata
export const metadata = {
  title: 'User Details',
  description: 'Get or update user information',
  auth: true,
  roles: ['admin', 'user']
};
```

## Database Adapters

OpenSpeed provides type-safe database adapters with connection pooling and multi-tenancy support.

### MongoDB

```typescript
import { createApp } from 'openspeed-framework';
import { database, MongoQueryBuilder } from 'openspeed-framework/plugins';

const app = createApp();

// Configure MongoDB with pooling
app.use(database('mongo', {
  type: 'mongodb',
  connection: 'mongodb://localhost:27017/myapp',
  pool: {
    min: 2,
    max: 10,
  },
  multiTenant: true,
  tenantKey: 'x-tenant-id',
}));

// Use in routes
app.get('/users', async (ctx) => {
  const db = ctx.db;
  const users = new MongoQueryBuilder(db, 'users');
  const result = await users.find({ active: true });
  return ctx.json(result);
});
```

### PostgreSQL

```typescript
import { database, SQLQueryBuilder } from 'openspeed-framework/plugins';

app.use(database('postgres', {
  type: 'postgresql',
  connection: 'postgresql://user:pass@localhost:5432/myapp',
  pool: {
    min: 2,
    max: 20,
    idleTimeoutMillis: 30000,
  },
}));

app.get('/products', async (ctx) => {
  const products = new SQLQueryBuilder(ctx.db, 'products');
  const result = await products.find({ category: 'electronics' });
  return ctx.json(result);
});
```

### Redis Cache

```typescript
import { database, RedisCache } from 'openspeed-framework/plugins';

app.use(database('redis', {
  type: 'redis',
  connection: 'redis://localhost:6379',
}));

app.get('/cached-data', async (ctx) => {
  const cache = new RedisCache(ctx.db);
  
  // Try cache first
  const cached = await cache.get('data');
  if (cached) {
    return ctx.json(cached);
  }
  
  // Fetch and cache
  const data = await fetchData();
  await cache.set('data', data, 300); // TTL 5 minutes
  return ctx.json(data);
});
```

## RBAC (Role-Based Access Control)

Advanced permission system with hierarchical roles and fine-grained access control.

### Setup

```typescript
import { createApp } from 'openspeed-framework';
import { rbac, requirePermission, requireRole, RoleBuilder } from 'openspeed-framework/plugins';

const app = createApp();

// Define roles
const roles = new RoleBuilder()
  .defineRole('user')
    .can('posts', ['read', 'create'])
    .can('comments', ['read', 'create', 'update', 'delete'])
    .build()
  .defineRole('moderator')
    .inherits('user')
    .can('posts', ['read', 'create', 'update', 'delete'])
    .can('users', ['read'])
    .build()
  .defineRole('admin')
    .inherits('moderator')
    .can('*', '*') // All permissions
    .build()
  .build();

// Configure RBAC
app.use(rbac({
  roles,
  getUserRoles: async (ctx) => {
    // Get user roles from session/JWT
    return ctx.user?.roles || [];
  },
  superAdminRole: 'admin',
  cache: true,
  cacheTTL: 300000, // 5 minutes
}));
```

### Usage in Routes

```typescript
// Check permissions
app.get('/posts/:id', async (ctx) => {
  // Manual check
  if (await ctx.can('posts', 'read')) {
    const post = await db.posts.findById(ctx.params.id);
    return ctx.json(post);
  }
  return ctx.text('Forbidden', 403);
});

// Require specific permission
app.delete('/posts/:id', 
  requirePermission('posts', 'delete'),
  async (ctx) => {
    await db.posts.delete(ctx.params.id);
    return ctx.json({ success: true });
  }
);

// Require specific role
app.get('/admin/dashboard',
  requireRole(['admin', 'moderator']),
  async (ctx) => {
    const stats = await getAdminStats();
    return ctx.json(stats);
  }
);

// Authorize (throws error if unauthorized)
app.put('/users/:id', async (ctx) => {
  await ctx.authorize('users', 'update');
  // Continue with update...
});
```

## Audit Logging

Comprehensive audit logging with compliance support (SOC 2, GDPR, HIPAA, PCI-DSS).

### Configuration

```typescript
import { auditLog } from 'openspeed-framework/plugins';

app.use(auditLog({
  storage: 'file',
  storageConfig: {
    filePath: './logs/audit',
    rotateDaily: true,
  },
  includeRequestBody: true,
  includeResponseBody: false,
  excludePaths: ['/health', '/metrics'],
  sensitiveFields: ['password', 'token', 'creditCard'],
  compliance: 'SOC2', // or 'GDPR', 'HIPAA', 'PCI-DSS'
  onLog: (entry) => {
    // Custom processing
    console.log('Audit:', entry.action, entry.resource);
  },
}));
```

### Query Logs

```typescript
import { queryAuditLogs } from 'openspeed-framework/plugins';

// Query audit logs
const logs = await queryAuditLogs('./logs/audit/audit-2025-11-01.log', {
  userId: 'user123',
  resource: 'users',
  action: 'update',
  success: true,
  startDate: new Date('2025-11-01'),
  endDate: new Date('2025-11-02'),
});
```

## Kubernetes Operator

Auto-scaling and deployment management for Kubernetes.

### Configuration

```typescript
import { kubernetesOperator, generateDeploymentManifest, generateHPAManifest } from 'openspeed-framework/plugins';

app.use(kubernetesOperator({
  namespace: 'production',
  deployment: 'my-app',
  minReplicas: 2,
  maxReplicas: 20,
  targetCPU: 70,
  targetMemory: 80,
  scaleUpThreshold: 80,
  scaleDownThreshold: 30,
  cooldownPeriod: 300000, // 5 minutes
}));

// Generate Kubernetes manifests
const deployment = generateDeploymentManifest('my-app', 'my-image:latest', 3, {
  cpu: '500m',
  memory: '512Mi',
});

const hpa = generateHPAManifest('my-app', 2, 20, 70);
```

## Adaptive Optimizer

Revolutionary performance optimization with ML-powered features.

### Configuration

```typescript
import { adaptiveOptimizer, ObjectPool } from 'openspeed-framework/plugins';

app.use(adaptiveOptimizer({
  enableBatching: true,
  enableCaching: true,
  enablePrefetching: true,
  enableCompression: true,
  ml: {
    enabled: true,
    trainingInterval: 3600000, // 1 hour
  },
  performance: {
    targetLatency: 100, // ms
    maxMemory: 512, // MB
    adaptiveThreshold: 0.8,
  },
}));

// Use object pooling for high-frequency objects
const bufferPool = new ObjectPool(
  () => Buffer.alloc(1024),
  (buffer) => buffer.fill(0),
  100 // max pool size
);

app.get('/data', async (ctx) => {
  const buffer = bufferPool.acquire();
  try {
    // Use buffer
    // ...
  } finally {
    bufferPool.release(buffer);
  }
});
```

## Multi-Tenant Example

Complete multi-tenant application example:

```typescript
import { createApp } from 'openspeed-framework';
import {
  database,
  rbac,
  auditLog,
  requirePermission,
  RoleBuilder,
} from 'openspeed-framework/plugins';

const app = createApp();

// 1. Multi-tenant database
app.use(database('mongo', {
  type: 'mongodb',
  connection: 'mongodb://localhost:27017',
  multiTenant: true,
  tenantKey: 'x-tenant-id',
}));

// 2. RBAC with roles
const roles = new RoleBuilder()
  .defineRole('tenant-user')
    .can('documents', ['read', 'create'])
    .build()
  .defineRole('tenant-admin')
    .inherits('tenant-user')
    .can('documents', ['read', 'create', 'update', 'delete'])
    .can('users', ['read', 'create', 'update'])
    .build()
  .build();

app.use(rbac({
  roles,
  getUserRoles: async (ctx) => ctx.user?.roles || [],
}));

// 3. Audit logging for compliance
app.use(auditLog({
  storage: 'database',
  storageConfig: {
    database: db,
  },
  compliance: 'SOC2',
  includeRequestBody: true,
}));

// 4. Multi-tenant routes
app.get('/documents',
  requirePermission('documents', 'read'),
  async (ctx) => {
    // Each tenant has isolated data
    const documents = await ctx.db.collection('documents').find().toArray();
    return ctx.json(documents);
  }
);

await app.listen(3000);
```

## Performance Comparison

### OpenSpeed vs Hono vs Elysia

With the new adaptive optimizer and advanced caching:

| Feature | OpenSpeed | Hono | Elysia |
|---------|-----------|------|--------|
| Request Batching | ✅ | ❌ | ❌ |
| ML-based Prefetching | ✅ | ❌ | ❌ |
| Adaptive Compression | ✅ | ✅ | ✅ |
| Bloom Filter Routing | ✅ | ❌ | ❌ |
| Object Pooling | ✅ | ❌ | ❌ |
| Multi-tenant DB | ✅ | ❌ | ❌ |
| RBAC Built-in | ✅ | ❌ | ❌ |
| Audit Logging | ✅ | ❌ | ❌ |
| K8s Integration | ✅ | ❌ | ❌ |
| File-based Routing | ✅ | ❌ | ❌ |

### Benchmarks (requests/second)

| Runtime | OpenSpeed | Hono | Elysia |
|---------|-----------|------|--------|
| Node.js | ~7,000 | ~3,200 | ~2,800 |
| Bun     | ~24,000 | ~11,500 | ~10,200 |
| Deno    | ~17,000 | ~8,000 | ~7,500 |

*Note: Benchmarks include adaptive optimizer features*
