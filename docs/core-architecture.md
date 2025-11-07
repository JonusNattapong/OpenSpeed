---
layout: default
title: Core Architecture
nav_order: 4
---

# Core Architecture

OpenSpeed is built on a modular, plugin-based architecture that emphasizes performance, type safety, and developer experience.

## Router

The router is the heart of OpenSpeed, providing fast route matching and parameter extraction.

### Features

- **Fast matching**: O(1) lookup for most routes
- **Parameter extraction**: Automatic parsing of path and query parameters
- **Middleware support**: Route-specific and global middleware
- **Type safety**: Full TypeScript support with inferred types

### Example

```typescript
app.get('/users/:id/posts/:postId', (ctx) => {
  const userId = ctx.getParam('id');
  const postId = ctx.getParam('postId');
  const limit = ctx.getQuery('limit');
  
  return ctx.json({ userId, postId, limit });
});
```

## Context

The context object provides access to request data, response helpers, and framework features.

### Request Helpers

- `ctx.getParam(name)` - Get route parameters
- `ctx.getQuery(name)` - Get query parameters
- `ctx.getBody()` - Get parsed request body
- `ctx.getHeader(name)` - Get request headers
- `ctx.getCookie(name)` - Get cookies

### Response Helpers

- `ctx.text(content, status?)` - Send text response
- `ctx.json(data, status?)` - Send JSON response
- `ctx.html(html, status?)` - Send HTML response
- `ctx.redirect(url, status?)` - Send redirect

## Plugin System

OpenSpeed's plugin system allows extending the framework with new capabilities.

### Built-in Plugins

- **Logger**: Request logging
- **CORS**: Cross-origin resource sharing
- **Upload**: File upload handling
- **WebSocket**: Real-time communication
- **Cookie**: Session management
- **Error Handler**: Centralized error handling

### Custom Plugins

```typescript
function myPlugin(options = {}) {
  return (ctx, next) => {
    // Extend context
    ctx.myMethod = () => 'Hello from plugin';
    
    return next();
  };
}

app.use(myPlugin());
```

## Performance Features

### Adaptive Optimization

OpenSpeed includes ML-powered optimization that adapts to your application's usage patterns.

### Object Pooling

Reusable object pools reduce garbage collection pressure.

### Zero-Copy Streaming

Large file transfers use streaming to minimize memory usage.

## Type Safety

OpenSpeed is designed with TypeScript first, providing excellent type inference and safety.

```typescript
app.get('/api/data', (ctx) => {
  // ctx is fully typed
  const body = ctx.getBody<{ name: string; age: number }>();
  
  return ctx.json({ success: true, data: body });
});
```

## Runtime Support

OpenSpeed runs on multiple JavaScript runtimes:

- **Node.js**: Full feature support
- **Bun**: Enhanced performance
- **Deno**: Secure execution environment
