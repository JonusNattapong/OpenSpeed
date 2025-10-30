# OpenSpeed API Reference

## Core API

### `createApp()`

Creates a new OpenSpeed application instance.

```typescript
const app = createApp();
```

**Returns:** `App` - The application instance

### `app.get(path, ...handlers)`

Register a GET route.

```typescript
app.get('/users', (ctx) => ctx.json(users));
app.get('/users/:id', (ctx) => ctx.json(getUser(ctx.params.id)));
```

### `app.post(path, ...handlers)`

Register a POST route.

```typescript
app.post('/users', (ctx) => {
  const user = ctx.getBody();
  return ctx.json(createUser(user));
});
```

### `app.put(path, ...handlers)`

Register a PUT route.

### `app.delete(path, ...handlers)`

Register a DELETE route.

### `app.patch(path, ...handlers)`

Register a PATCH route.

### `app.options(path, ...handlers)`

Register an OPTIONS route.

### `app.ws(path, handler)`

Register a WebSocket route.

```typescript
app.ws('/chat/:room', (ws, ctx) => {
  const room = ctx.params.room;
  ws.join(room);

  ws.on('message', (data) => {
    ws.broadcast(room, data);
  });
});
```

### `app.use(middleware)`

Add global middleware.

```typescript
app.use(logger());
app.use(cors());
```

### `app.listen(port?)`

Start the server.

```typescript
await app.listen(3000); // Listen on port 3000
await app.listen();     // Listen on default port (3000)
```

### `app.routes()`

Get all registered routes.

```typescript
const routes = app.routes();
// Returns: [{ method: 'GET', path: '/users', middlewares: ['cors', 'logger'] }, ...]
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

## Context API

### Response Helpers

#### `ctx.text(content, status?)`

Send a text response.

```typescript
return ctx.text('Hello World');
return ctx.text('Error', 500);
```

#### `ctx.json(data, status?)`

Send a JSON response.

```typescript
return ctx.json({ message: 'Success' });
return ctx.json({ error: 'Not found' }, 404);
```

#### `ctx.html(html, status?)`

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

### Request Helpers

#### `ctx.getQuery(name)`

Get a query parameter.

```typescript
const limit = ctx.getQuery('limit'); // string | undefined
```

#### `ctx.getParam(name)`

Get a route parameter.

```typescript
const id = ctx.getParam('id'); // string | undefined
```

#### `ctx.getBody()`

Get the parsed request body.

```typescript
const data = ctx.getBody(); // any
```

#### `ctx.getUser()`

Get the authenticated user (from auth middleware).

```typescript
const user = ctx.getUser(); // any
```

### Cookie Helpers

#### `ctx.setCookie(name, value, options?)`

Set a cookie.

```typescript
ctx.setCookie('session', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 86400
});
```

#### `ctx.getCookie(name)`

Get a cookie value.

```typescript
const session = ctx.getCookie('session'); // string | undefined
```

### Header Helpers

#### `ctx.setHeader(name, value)`

Set a response header.

```typescript
ctx.setHeader('X-Custom', 'value');
```

#### `ctx.getHeader(name)`

Get a response header.

```typescript
const custom = ctx.getHeader('X-Custom'); // string | string[] | undefined
```

#### `ctx.setStatus(status)`

Set the response status code.

```typescript
ctx.setStatus(201);
```

## Plugin APIs

### Upload Plugin

#### File Upload Types

```typescript
interface FileUpload {
  filename: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  stream?: any;
  path?: string;
}
```

#### Context Extensions

```typescript
interface RequestLike {
  files?: Record<string, FileUpload[]>;
  file?: FileUpload;
}
```

### WebSocket Plugin

#### WebSocket Context

```typescript
interface WebSocketContext {
  join(room: string): void;
  leave(room: string): void;
  send(data: any): void;
  broadcast(room: string, data: any): void;
  broadcastAll(room: string, data: any): void;
  on(event: string, handler: Function): void;
}
```

### Cookie Plugin

#### CookieJar Interface

```typescript
interface CookieJar {
  set(name: string, value: string, options?: CookieOptions): void;
  get(name: string): string | undefined;
  delete(name: string): void;
  clear(): void;
  toHeaderString(): string;
}

interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  priority?: 'low' | 'medium' | 'high';
}
```

### Error Handler Plugin

#### HttpError Class

```typescript
class HttpError extends Error {
  constructor(status: number, message: string, details?: any);
  status: number;
  details?: any;
}
```

## Type Definitions

### RequestLike

```typescript
interface RequestLike {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  query?: Record<string, string>;
  user?: any;
  files?: Record<string, FileUpload[]>;
  file?: FileUpload;
}
```

### ResponseLike

```typescript
interface ResponseLike {
  status?: number;
  headers?: Record<string, string>;
  body?: any;
}
```

### Context

```typescript
class Context {
  req: RequestLike;
  res: ResponseLike;
  params: Record<string, string>;
  cookies?: CookieJar;

  // Response helpers
  text(content: string, status?: number): ResponseLike;
  json(data: any, status?: number): ResponseLike;
  html(html: string, status?: number): ResponseLike;
  redirect(url: string, status?: number): ResponseLike;

  // Request helpers
  getQuery(name: string): string | undefined;
  getParam(name: string): string | undefined;
  getBody(): any;
  getUser(): any;

  // Cookie helpers
  setCookie(name: string, value: string, options?: any): this;
  getCookie(name: string): string | undefined;

  // Header helpers
  setHeader(name: string, value: string): this;
  getHeader(name: string): string | string[] | undefined;
  setStatus(status: number): this;
}
```