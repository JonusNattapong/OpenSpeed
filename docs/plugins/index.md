# OpenSpeed Plugins

OpenSpeed provides a rich ecosystem of plugins to extend your application's functionality. All plugins follow a consistent API and can be easily combined.

## Core Plugins

### [File Upload](./upload.md)
Handle multipart form data with streaming support for file uploads.

```typescript
import { upload } from 'openspeed-framework/plugins/upload';
app.use(upload());
```

### [WebSocket](./websocket.md)
Real-time bidirectional communication with room-based messaging.

```typescript
import { websocket } from 'openspeed-framework/plugins/websocket';
app.use(websocket());
```

### [Cookies](./cookie.md)
Session management and state persistence with CookieJar.

```typescript
import { cookie } from 'openspeed-framework/plugins/cookie';
app.use(cookie());
```

### [Error Handler](./errorHandler.md)
Comprehensive error management with typed exceptions.

```typescript
import { errorHandler } from 'openspeed-framework/plugins/errorHandler';
app.use(errorHandler());
```

## Community Plugins

### Logger
Request logging with customizable formats.

```typescript
import { logger } from 'openspeed-framework/plugins/logger';
app.use(logger({ format: 'combined' }));
```

### JSON Parser
Parse JSON request bodies with size limits.

```typescript
import { json } from 'openspeed-framework/plugins/json';
app.use(json({ limit: '10mb' }));
```

### CORS
Cross-origin resource sharing configuration.

```typescript
import { cors } from 'openspeed-framework/plugins/cors';
app.use(cors({ origin: '*', credentials: true }));
```

### OpenAPI
Auto-generate API documentation.

```typescript
import { openapi } from 'openspeed-framework/plugins/openapi';
const api = openapi({ title: 'My API', version: '1.0.0' });
app.use(api.middleware);
```

## Creating Custom Plugins

Plugins are simple middleware functions that can extend the context and provide additional functionality.

### Basic Plugin Structure

```typescript
function myPlugin(options = {}) {
  return (ctx, next) => {
    // Add functionality to context
    ctx.myMethod = () => {
      return 'Hello from my plugin!';
    };

    // Call next middleware
    return next();
  };
}

// Usage
app.use(myPlugin({ config: 'value' }));

app.get('/', (ctx) => {
  return ctx.text(ctx.myMethod());
});
```

### Plugin with Options

```typescript
function rateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  const requests = new Map();

  return (ctx, next) => {
    const key = getClientIP(ctx);
    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Clean old requests
    const userRequests = requests.get(key) || [];
    const recentRequests = userRequests.filter(time => time > windowStart);

    if (recentRequests.length >= options.max) {
      return ctx.json({
        error: options.message || 'Too many requests'
      }, 429);
    }

    recentRequests.push(now);
    requests.set(key, recentRequests);

    return next();
  };
}
```

### Context Extension Plugins

```typescript
declare module 'openspeed-framework' {
  interface Context {
    cache: Map<string, any>;
  }
}

function cache(options = {}) {
  return (ctx, next) => {
    ctx.cache = new Map();
    return next();
  };
}
```

## Plugin Best Practices

1. **Consistent API**: Follow the `(ctx, next) => any` middleware signature
2. **Type Safety**: Provide TypeScript definitions for extended context
3. **Error Handling**: Handle errors gracefully and throw appropriate HttpErrors
4. **Configuration**: Accept options objects for customization
5. **Documentation**: Document all options and usage examples
6. **Testing**: Include comprehensive tests for your plugin

## Plugin Discovery

Plugins can be published to npm with the `openspeed-plugin` keyword for easy discovery.

```json
{
  "name": "openspeed-plugin-my-feature",
  "keywords": ["openspeed", "openspeed-plugin"],
  "peerDependencies": {
    "openspeed-framework": "^0.1.0"
  }
}
```

## Contributing Plugins

We welcome community contributions! Here's how to contribute a plugin:

1. Create your plugin following the patterns above
2. Add comprehensive tests
3. Write documentation with examples
4. Submit a pull request

See our [Contributing Guide](../CONTRIBUTING.md) for more details.