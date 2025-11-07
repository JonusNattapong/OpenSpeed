---
layout: default
title: Websocket
parent: Plugins
---

# WebSocket Plugin

The WebSocket plugin provides real-time bidirectional communication with room-based messaging and connection management.

## Installation

```typescript
import { websocket } from 'openspeed-framework/plugins/websocket';

const app = createApp();
app.use(websocket());
```

## Basic Usage

### Simple Echo Server

```typescript
app.ws('/echo', (ws) => {
  ws.on('message', (data) => {
    ws.send(`Echo: ${data}`);
  });

  ws.on('close', () => {
    console.log('Connection closed');
  });
});
```

### Chat Application

```typescript
app.ws('/chat/:room', (ws, ctx) => {
  const room = ctx.params.room;
  const userId = ctx.getQuery('user') || 'Anonymous';

  // Join the room
  ws.join(room);
  ws.broadcast(room, `${userId} joined the room`);

  // Handle messages
  ws.on('message', (data) => {
    ws.broadcast(room, {
      user: userId,
      message: data,
      timestamp: new Date().toISOString()
    });
  });

  // Handle room changes
  ws.on('join-room', (newRoom) => {
    ws.leave(room);
    ws.join(newRoom);
    ws.send(`Switched to room: ${newRoom}`);
  });

  // Handle disconnection
  ws.on('close', () => {
    ws.broadcast(room, `${userId} left the room`);
  });
});
```

## Room Management

### Joining and Leaving Rooms

```typescript
app.ws('/room/:roomId', (ws, ctx) => {
  const roomId = ctx.params.roomId;

  // Join room
  ws.join(roomId);

  // Send welcome message to the user
  ws.send(`Welcome to room ${roomId}!`);

  // Notify others in the room
  ws.broadcast(roomId, 'A new user joined');

  // Handle room switching
  ws.on('switch-room', (newRoomId) => {
    ws.leave(roomId);
    ws.join(newRoomId);
    ws.send(`Switched to room ${newRoomId}`);
  });
});
```

### Broadcasting

```typescript
app.ws('/broadcast', (ws) => {
  ws.on('announce', (message) => {
    // Send to all in current room
    ws.broadcast(ws.room, message);

    // Send to everyone including sender
    ws.broadcastAll(ws.room, message);
  });
});
```

## WebSocket Context API

### Properties

```typescript
interface WebSocketContext {
  // Current room
  room?: string;

  // Connection state
  readyState: number; // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
}
```

### Methods

#### `ws.send(data)`

Send data to the connected client.

```typescript
ws.send('Hello from server!');
ws.send({ type: 'notification', message: 'Update available' });
```

#### `ws.join(room)`

Join a room for broadcasting.

```typescript
ws.join('general');
ws.join('room-123');
```

#### `ws.leave(room)`

Leave a room.

```typescript
ws.leave('general');
```

#### `ws.broadcast(room, data)`

Send data to all clients in a room except the sender.

```typescript
ws.broadcast('chat', { user: 'Alice', message: 'Hello everyone!' });
```

#### `ws.broadcastAll(room, data)`

Send data to all clients in a room including the sender.

```typescript
ws.broadcastAll('announcements', 'Server restarting in 5 minutes');
```

#### `ws.on(event, handler)`

Register event handlers.

```typescript
ws.on('message', (data) => {
  console.log('Received:', data);
});

ws.on('close', () => {
  console.log('Connection closed');
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

## Events

### Built-in Events

- `message` - Fired when a message is received
- `close` - Fired when the connection is closed
- `error` - Fired when an error occurs
- `ping` - Fired when a ping frame is received
- `pong` - Fired when a pong frame is received

### Custom Events

You can send custom events from the client:

```javascript
// Client-side JavaScript
const ws = new WebSocket('ws://localhost:3000/chat');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};

// Send custom events
ws.send(JSON.stringify({
  type: 'join-room',
  room: 'general'
}));

ws.send(JSON.stringify({
  type: 'message',
  content: 'Hello!'
}));
```

## Authentication

```typescript
app.ws('/protected', (ws, ctx) => {
  const token = ctx.getQuery('token');

  if (!token || !isValidToken(token)) {
    ws.send({ error: 'Authentication required' });
    ws.close();
    return;
  }

  // Authenticated connection
  ws.on('message', (data) => {
    ws.send(`Authenticated message: ${data}`);
  });
});
```

## Connection Limits

```typescript
// Track connections per room
const roomConnections = new Map<string, Set<WebSocket>>();

app.ws('/limited/:room', (ws, ctx) => {
  const room = ctx.params.room;
  const maxConnections = 10;

  if (!roomConnections.has(room)) {
    roomConnections.set(room, new Set());
  }

  const connections = roomConnections.get(room)!;

  if (connections.size >= maxConnections) {
    ws.send({ error: 'Room is full' });
    ws.close();
    return;
  }

  connections.add(ws);
  ws.join(room);

  ws.on('close', () => {
    connections.delete(ws);
  });
});
```

## Heartbeat/Ping-Pong

```typescript
app.ws('/heartbeat', (ws) => {
  // Send ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) { // OPEN
      ws.ping();
    }
  }, 30000);

  ws.on('pong', () => {
    console.log('Received pong from client');
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
  });
});
```

## Integration with HTTP Routes

```typescript
// HTTP route to get room info
app.get('/rooms/:room/info', (ctx) => {
  const room = ctx.params.room;
  // Get room statistics
  return ctx.json({
    room,
    connections: getRoomConnectionCount(room),
    messages: getRecentMessages(room)
  });
});

// WebSocket for real-time updates
app.ws('/rooms/:room', (ws, ctx) => {
  const room = ctx.params.room;
  ws.join(room);

  ws.on('message', (data) => {
    // Store message for HTTP API
    saveMessage(room, data);
    ws.broadcast(room, data);
  });
});
```

## Error Handling

```typescript
app.use(errorHandler());

app.ws('/robust', (ws) => {
  try {
    ws.on('message', (data) => {
      // Process message
      const result = processMessage(data);
      ws.send(result);
    });
  } catch (error) {
    ws.send({ error: 'Failed to process message' });
    console.error('WebSocket error:', error);
  }

  ws.on('error', (error) => {
    console.error('WebSocket connection error:', error);
  });
});
```

## Performance Considerations

1. **Connection Limits**: Implement reasonable connection limits per room
2. **Message Size**: Validate and limit message sizes
3. **Rate Limiting**: Implement rate limiting for message sending
4. **Cleanup**: Properly clean up resources on disconnection
5. **Serialization**: Use efficient serialization (JSON, MessagePack)

## Examples

See the [WebSocket chat example](../../examples/websocket-chat/) for a complete implementation.