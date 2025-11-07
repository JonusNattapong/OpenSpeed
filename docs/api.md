---
layout: default
title: API Reference
nav_order: 3
---

# OpenSpeed API Reference

This comprehensive API reference covers all aspects of the OpenSpeed framework, including core functionality, plugins, and type definitions.

## Table of Contents

- [Core API](#core-api)
- [Context API](#context-api)
- [Plugin APIs](#plugin-apis)
- [Type Definitions](#type-definitions)

## Core API

### `createApp(options?)`

Creates a new OpenSpeed application instance.

```typescript
const app = createApp({
  trustProxy: false,
  caseSensitive: false,
  strict: false
});
```

**Parameters:**
- `options` (optional): Application configuration
  - `trustProxy`: Trust proxy headers (default: false)
  - `caseSensitive`: Case-sensitive routing (default: false)
  - `strict`: Strict routing (default: false)

**Returns:** `App` - The application instance

### `app.get(path, ...handlers)`

Register a GET route.

```typescript
app.get('/', (ctx) => ctx.text('Hello World'));
app.get('/users/:id', (ctx) => ctx.json(getUser(ctx.params.id)));
app.get('/api/*', middleware, handler);
```

### `app.post(path, ...handlers)`

Register a POST route.

### `app.put(path, ...handlers)`

Register a PUT route.

### `app.delete(path, ...handlers)`

Register a DELETE route.

### `app.patch(path, ...handlers)`

Register a PATCH route.

### `app.options(path, ...handlers)`

Register an OPTIONS route.

### `app.head(path, ...handlers)`

Register a HEAD route.

### `app.all(path, ...handlers)`

Register a route for all HTTP methods.

### `app.use(middleware)`

Add global middleware.

```typescript
app.use(logger());
app.use(cors());
app.use(rateLimit({ windowMs: 60000, max: 100 }));
```

### `app.route(path)`

Create a route group.

```typescript
const api = app.route('/api');
api.get('/users', getUsersHandler);
api.post('/users', createUserHandler);
```

### `app.listen(port?, options?)`

Start the server.

```typescript
await app.listen(3000);
await app.listen({ port: 3000, host: '0.0.0.0' });
```

**Parameters:**
- `port` (optional): Port number (default: 3000)
- `options` (optional): Server options
  - `host`: Host address
  - `backlog`: Connection backlog
  - `exclusive`: Exclusive port binding

### `app.close()`

Stop the server.

```typescript
await app.close();
```

### `app.routes()`

Get all registered routes.

```typescript
const routes = app.routes();
// Returns: [{ method: 'GET', path: '/users', handlers: [...], middlewares: [...] }, ...]
```

### `app.printRoutes()`

Print all routes to console.

```typescript
app.printRoutes();
// Output:
//   GET    /users     [cors, logger]
//   POST   /users     [cors, json]
//   GET    /users/:id [cors, logger]
```

### `app.onError(handler)`

Set global error handler.

```typescript
app.onError((error, ctx) => {
  console.error(error);
  return ctx.json({ error: 'Internal Server Error' }, 500);
});
```

### `app.onRequest(handler)`

Set request hook.

```typescript
app.onRequest((ctx) => {
  console.log(`${ctx.method} ${ctx.path}`);
});
```

### `app.onResponse(handler)`

Set response hook.

```typescript
app.onResponse((ctx, response) => {
  console.log(`${ctx.method} ${ctx.path} -> ${response.status}`);
});
```

## Context API

The context object provides access to request data, response helpers, and framework features.

### Request Properties

#### `ctx.method`

HTTP method (GET, POST, etc.)

#### `ctx.path`

Request path

#### `ctx.url`

Full request URL

#### `ctx.query`

Query parameters object

#### `ctx.params`

Route parameters object

#### `ctx.headers`

Request headers object

#### `ctx.body`

Parsed request body (when using body parser middleware)

#### `ctx.cookies`

Cookie jar instance

#### `ctx.user`

Authenticated user (when using auth middleware)

#### `ctx.session`

Session data (when using session middleware)

### Request Helpers

#### `ctx.getQuery(name)`

Get a query parameter.

```typescript
const limit = ctx.getQuery('limit'); // string | undefined
const page = ctx.getQuery('page') || '1';
```

#### `ctx.getParam(name)`

Get a route parameter.

```typescript
const id = ctx.getParam('id'); // string | undefined
```

#### `ctx.getHeader(name)`

Get a request header.

```typescript
const auth = ctx.getHeader('authorization');
const userAgent = ctx.getHeader('user-agent');
```

#### `ctx.getCookie(name)`

Get a cookie value.

```typescript
const sessionId = ctx.getCookie('session');
```

#### `ctx.getBody()`

Get the parsed request body.

```typescript
const data = ctx.getBody(); // any
```

#### `ctx.getUser()`

Get the authenticated user.

```typescript
const user = ctx.getUser(); // any
```

### Response Helpers

#### `ctx.text(content, status?, headers?)`

Send a text response.

```typescript
return ctx.text('Hello World');
return ctx.text('Error', 500);
return ctx.text('OK', 200, { 'X-Custom': 'value' });
```

#### `ctx.json(data, status?, headers?)`

Send a JSON response.

```typescript
return ctx.json({ message: 'Success' });
return ctx.json({ error: 'Not found' }, 404);
```

#### `ctx.html(html, status?, headers?)`

Send an HTML response.

```typescript
return ctx.html('<h1>Hello</h1>');
```

#### `ctx.redirect(url, status?)`

Send a redirect response.

```typescript
return ctx.redirect('/login');
return ctx.redirect('/dashboard', 302);
```

#### `ctx.stream(generator, options?)`

Send a streaming response.

```typescript
return ctx.stream(async function* () {
  yield 'Hello';
  yield ' ';
  yield 'World';
}());
```

#### `ctx.file(path, options?)`

Send a file response.

```typescript
return ctx.file('./public/index.html');
return ctx.file('./files/document.pdf', { filename: 'my-doc.pdf' });
```

### Response Modifiers

#### `ctx.setStatus(status)`

Set the response status code.

```typescript
ctx.setStatus(201);
return ctx.json(data);
```

#### `ctx.setHeader(name, value)`

Set a response header.

```typescript
ctx.setHeader('X-Custom', 'value');
ctx.setHeader('Cache-Control', 'no-cache');
```

#### `ctx.setCookie(name, value, options?)`

Set a cookie.

```typescript
ctx.setCookie('session', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 86400
});
```

#### `ctx.clearCookie(name)`

Clear a cookie.

```typescript
ctx.clearCookie('session');
```

## Plugin APIs

### Logger Plugin

#### `logger(options?)`

Request logging middleware.

```typescript
import { logger } from 'openspeed/plugins/logger';

app.use(logger({
  format: 'combined', // 'combined', 'common', 'dev', 'short', 'tiny'
  skip: (ctx) => ctx.path === '/health',
  stream: process.stdout
}));
```

**Options:**
- `format`: Log format (default: 'combined')
- `skip`: Function to skip logging certain requests
- `stream`: Output stream (default: process.stdout)

### CORS Plugin

#### `cors(options?)`

Cross-origin resource sharing middleware.

```typescript
import { cors } from 'openspeed/plugins/cors';

app.use(cors({
  origin: ['https://example.com', 'https://app.example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  headers: ['Content-Type', 'Authorization']
}));
```

**Options:**
- `origin`: Allowed origins (default: '*')
- `credentials`: Allow credentials (default: false)
- `methods`: Allowed methods (default: all)
- `headers`: Allowed headers (default: common headers)
- `maxAge`: Preflight cache duration (default: 86400)

### JSON Parser Plugin

#### `json(options?)`

JSON body parser middleware.

```typescript
import { json } from 'openspeed/plugins/json';

app.use(json({
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));
```

**Options:**
- `limit`: Body size limit (default: '100kb')
- `strict`: Strict JSON parsing (default: true)
- `type`: Content type to parse (default: 'application/json')

### Rate Limit Plugin

#### `rateLimit(options)`

Rate limiting middleware.

```typescript
import { rateLimit } from 'openspeed/plugins/rateLimit';

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (ctx) => ctx.getHeader('x-api-key') === 'trusted-key'
}));
```

**Options:**
- `windowMs`: Time window in milliseconds (default: 15 minutes)
- `max`: Maximum requests per window (default: 100)
- `message`: Response message when limit exceeded
- `statusCode`: Response status code (default: 429)
- `standardHeaders`: Include rate limit headers (default: true)
- `legacyHeaders`: Include legacy headers (default: false)
- `skip`: Function to skip rate limiting

### Authentication Plugin

#### `auth(options)`

Authentication middleware.

```typescript
import { auth } from 'openspeed/plugins/auth';

app.use(auth({
  secret: process.env.JWT_SECRET,
  algorithm: 'HS256',
  expiresIn: '24h'
}));

app.get('/protected', (ctx) => {
  const user = ctx.getUser();
  return ctx.json({ user });
});
```

**Options:**
- `secret`: JWT secret key
- `algorithm`: JWT algorithm (default: 'HS256')
- `expiresIn`: Token expiration time (default: '24h')
- `issuer`: Token issuer
- `audience`: Token audience

### Session Plugin

#### `session(options)`

Session management middleware.

```typescript
import { session } from 'openspeed/plugins/session';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.get('/session', (ctx) => {
  ctx.session.views = (ctx.session.views || 0) + 1;
  return ctx.json({ views: ctx.session.views });
});
```

**Options:**
- `secret`: Session secret
- `resave`: Force session save on every request (default: false)
- `saveUninitialized`: Save uninitialized sessions (default: false)
- `cookie`: Cookie options

### File Upload Plugin

#### `upload(options?)`

File upload middleware.

```typescript
import { upload } from 'openspeed/plugins/upload';

app.use(upload({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  preservePath: false
}));

app.post('/upload', (ctx) => {
  const file = ctx.file;
  const files = ctx.files?.documents || [];

  return ctx.json({
    file: file?.filename,
    files: files.map(f => f.filename)
  });
});
```

**Options:**
- `limits.fileSize`: Maximum file size
- `limits.files`: Maximum number of files
- `preservePath`: Preserve file paths (default: false)

**File Object:**
```typescript
interface FileUpload {
  filename: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  stream?: ReadableStream;
  path?: string;
}
```

### WebSocket Plugin

#### `websocket(options?)`

WebSocket support middleware.

```typescript
import { websocket } from 'openspeed/plugins/websocket';

app.use(websocket({
  heartbeat: 30000,
  maxConnections: 1000
}));

app.ws('/chat/:room', (ws, ctx) => {
  const room = ctx.params.room;

  ws.join(room);

  ws.on('message', (data) => {
    ws.broadcast(room, { message: data, user: ws.id });
  });

  ws.on('join', (newRoom) => {
    ws.leave(room);
    ws.join(newRoom);
  });
});
```

**Options:**
- `heartbeat`: Heartbeat interval in ms (default: 30000)
- `maxConnections`: Maximum connections (default: 1000)

**WebSocket Methods:**
- `ws.send(data)`: Send message to client
- `ws.broadcast(room, data)`: Broadcast to room
- `ws.broadcastAll(data)`: Broadcast to all
- `ws.join(room)`: Join a room
- `ws.leave(room)`: Leave a room
- `ws.close()`: Close connection

### Database Plugin

#### `database(options)`

Database connection middleware.

```typescript
import { database } from 'openspeed/plugins/database';

app.use(database({
  type: 'postgresql',
  connectionString: process.env.DATABASE_URL,
  poolSize: 10
}));

app.get('/users', async (ctx) => {
  const users = await ctx.db.query('SELECT * FROM users');
  return ctx.json(users);
});
```

**Supported Databases:**
- PostgreSQL
- MySQL
- SQLite
- MongoDB
- Redis

### Cache Plugin

#### `cache(options)`

Caching middleware.

```typescript
import { cache } from 'openspeed/plugins/cache';

app.use(cache({
  ttl: 300, // 5 minutes
  maxSize: 1000,
  strategy: 'lru'
}));

app.get('/data', async (ctx) => {
  // Data will be cached for 5 minutes
  const data = await getData();
  return ctx.json(data);
});
```

**Options:**
- `ttl`: Time to live in seconds
- `maxSize`: Maximum cache size
- `strategy`: Cache strategy ('lru', 'lfu', 'fifo')

### Compression Plugin

#### `compression(options?)`

Response compression middleware.

```typescript
import { compression } from 'openspeed/plugins/compression';

app.use(compression({
  threshold: 1024, // compress responses > 1KB
  level: 6,
  encodings: ['gzip', 'deflate', 'br']
}));
```

**Options:**
- `threshold`: Minimum response size to compress
- `level`: Compression level (1-9)
- `encodings`: Supported encodings

### Security Plugin

#### `security(options?)`

Security headers middleware.

```typescript
import { security } from 'openspeed/plugins/security';

app.use(security({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Options:**
- `contentSecurityPolicy`: CSP directives
- `hsts`: HTTP Strict Transport Security
- `noSniff`: X-Content-Type-Options
- `frameOptions`: X-Frame-Options
- `referrerPolicy`: Referrer-Policy

## Type Definitions

### Core Types

#### `App`

```typescript
interface App {
  get(path: string, ...handlers: Handler[]): this;
  post(path: string, ...handlers: Handler[]): this;
  put(path: string, ...handlers: Handler[]): this;
  delete(path: string, ...handlers: Handler[]): this;
  patch(path: string, ...handlers: Handler[]): this;
  options(path: string, ...handlers: Handler[]): this;
  head(path: string, ...handlers: Handler[]): this;
  all(path: string, ...handlers: Handler[]): this;
  use(...middlewares: Middleware[]): this;
  route(path: string): Router;
  listen(port?: number | ListenOptions): Promise<void>;
  close(): Promise<void>;
  routes(): RouteInfo[];
  printRoutes(): void;
  onError(handler: ErrorHandler): this;
  onRequest(handler: RequestHook): this;
  onResponse(handler: ResponseHook): this;
}
```

#### `Context`

```typescript
interface Context {
  readonly method: string;
  readonly path: string;
  readonly url: string;
  readonly query: Record<string, string>;
  readonly params: Record<string, string>;
  readonly headers: Record<string, string | string[]>;
  body?: any;
  cookies?: CookieJar;
  user?: any;
  session?: any;

  getQuery(name: string): string | undefined;
  getParam(name: string): string | undefined;
  getHeader(name: string): string | string[] | undefined;
  getCookie(name: string): string | undefined;
  getBody<T = any>(): T;
  getUser<T = any>(): T;

  text(content: string, status?: number, headers?: Record<string, string>): Response;
  json(data: any, status?: number, headers?: Record<string, string>): Response;
  html(html: string, status?: number, headers?: Record<string, string>): Response;
  redirect(url: string, status?: number): Response;
  stream(generator: AsyncGenerator, options?: StreamOptions): Response;
  file(path: string, options?: FileOptions): Response;

  setStatus(status: number): this;
  setHeader(name: string, value: string): this;
  setCookie(name: string, value: string, options?: CookieOptions): this;
  clearCookie(name: string): this;
}
```

#### `Handler`

```typescript
type Handler = (ctx: Context) => Response | Promise<Response> | void;
```

#### `Middleware`

```typescript
type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void> | void;
```

#### `ErrorHandler`

```typescript
type ErrorHandler = (error: Error, ctx: Context) => Response | Promise<Response> | void;
```

#### `RequestHook`

```typescript
type RequestHook = (ctx: Context) => void | Promise<void>;
```

#### `ResponseHook`

```typescript
type ResponseHook = (ctx: Context, response: Response) => void | Promise<void>;
```

### Plugin Types

#### `CookieOptions`

```typescript
interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}
```

#### `ListenOptions`

```typescript
interface ListenOptions {
  port?: number;
  host?: string;
  backlog?: number;
  exclusive?: boolean;
}
```

#### `RouteInfo`

```typescript
interface RouteInfo {
  method: string;
  path: string;
  handlers: Handler[];
  middlewares: Middleware[];
}
```

#### `StreamOptions`

```typescript
interface StreamOptions {
  contentType?: string;
  headers?: Record<string, string>;
}
```

#### `FileOptions`

```typescript
interface FileOptions {
  filename?: string;
  contentType?: string;
  headers?: Record<string, string>;
}
```

### Response Types

#### `Response`

```typescript
interface Response {
  status: number;
  headers: Record<string, string>;
  body?: any;
  stream?: AsyncGenerator;
  file?: string;
}
```

This comprehensive API reference covers all major components of the OpenSpeed framework. For more detailed examples and usage patterns, see the [examples](../examples/) and [guides](../guides/) sections.

