---
layout: default
title: Quick Start
nav_order: 3
---

# Quick Start

This guide will get you up and running with OpenSpeed in minutes.

## Hello World

Create a file called `server.ts`:

```typescript
import { createApp } from 'openspeed-framework';

const app = createApp();

app.get('/', (ctx) => {
  return ctx.text('Hello, OpenSpeed!');
});

await app.listen(3000);
console.log('Server running at http://localhost:3000');
```

Run it:

```bash
node server.ts
```

Visit `http://localhost:3000` in your browser.

## Adding Routes

```typescript
app.get('/api/users', (ctx) => {
  return ctx.json([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]);
});

app.post('/api/users', (ctx) => {
  const user = ctx.getBody();
  // Save user logic here
  return ctx.json({ success: true, user });
});

app.get('/api/users/:id', (ctx) => {
  const id = ctx.getParam('id');
  return ctx.json({ id, name: `User ${id}` });
});
```

## Middleware

```typescript
import { logger, cors } from 'openspeed-framework/plugins';

app.use(logger());
app.use(cors());
```

## File Upload

```typescript
import { upload } from 'openspeed-framework/plugins/upload';

app.use(upload());

app.post('/upload', (ctx) => {
  const file = ctx.file;
  return ctx.json({
    filename: file.filename,
    size: file.size
  });
});
```

## WebSocket

```typescript
import { websocket } from 'openspeed-framework/plugins/websocket';

app.use(websocket());

app.ws('/chat', (ws) => {
  ws.on('message', (data) => {
    ws.send(`Echo: ${data}`);
  });
});
```

## Next Steps

- [API Reference](api.md)
- [Guides](guides/)
- [Plugins](plugins/)
