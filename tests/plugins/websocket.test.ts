import { describe, it, expect, beforeEach, vi } from 'vitest';
import { websocket, WebSocketRoom, wsRoom } from '../../src/openspeed/plugins/websocket.js';
import Context from '../../src/openspeed/context.js';

// Mock WebSocket for testing
class MockWebSocket {
  public readyState = 1; // OPEN
  static OPEN = 1;

  send(data: any) {
    // Mock send
  }
}

// Make WebSocket available globally for the tests
(globalThis as any).WebSocket = MockWebSocket;

describe('websocket plugin', () => {
  it('should register websocket route', () => {
    const app: any = {
      get: (path: string, handler: any) => {
        expect(path).toBe('/ws');
        expect(handler).toBeDefined();
      },
    };

    const handler = {
      message: (ws: any, message: any) => {
        // Handler
      },
    };

    const plugin = websocket('/ws', handler);
    plugin(app);

    expect(app._websocketRoutes).toBeDefined();
    expect(app._websocketRoutes).toHaveLength(1);
    expect(app._websocketRoutes[0].path).toBe('/ws');
  });

  it('should store websocket handler options', () => {
    const app: any = {
      get: () => {},
      _websocketRoutes: [],
    };

    const handler = {
      message: (ws: any, message: any) => {},
    };

    const options = {
      idleTimeout: 30000,
      maxConnections: 100,
    };

    const plugin = websocket('/chat', handler, options);
    plugin(app);

    expect(app._websocketRoutes[0].options).toEqual(options);
  });

  it('should return upgrade required for GET request', () => {
    const app: any = {
      _websocketRoutes: [],
      get: (path: string, handler: any) => {
        const req: any = {
          method: 'GET',
          url: '/ws',
          headers: {},
        };
        const ctx = new Context(req, {});
        handler(ctx);

        expect(ctx.res.status).toBe(426);
        expect(ctx.res.body).toBe('Upgrade Required');
        expect(ctx.res.headers!['Upgrade']).toBe('websocket');
      },
    };

    const handler = {
      message: () => {},
    };

    const plugin = websocket('/ws', handler);
    plugin(app);
  });
});

describe('WebSocketRoom', () => {
  let room: WebSocketRoom;
  let ws1: MockWebSocket;
  let ws2: MockWebSocket;

  beforeEach(() => {
    room = new WebSocketRoom();
    ws1 = new MockWebSocket() as any;
    ws2 = new MockWebSocket() as any;
  });

  it('should join a room', () => {
    room.join(ws1 as any, 'room1');
    expect(room.getRoomSize('room1')).toBe(1);
  });

  it('should join multiple clients to same room', () => {
    room.join(ws1 as any, 'room1');
    room.join(ws2 as any, 'room1');
    expect(room.getRoomSize('room1')).toBe(2);
  });

  it('should leave a room', () => {
    room.join(ws1 as any, 'room1');
    room.join(ws2 as any, 'room1');
    room.leave(ws1 as any, 'room1');
    expect(room.getRoomSize('room1')).toBe(1);
  });

  it('should leave all rooms when no room specified', () => {
    room.join(ws1 as any, 'room1');
    room.join(ws1 as any, 'room2');
    room.leave(ws1 as any);
    expect(room.getRoomSize('room1')).toBe(0);
    expect(room.getRoomSize('room2')).toBe(0);
  });

  it('should broadcast to room members', () => {
    let ws1Messages: any[] = [];
    let ws2Messages: any[] = [];

    ws1.send = (data: any) => ws1Messages.push(data);
    ws2.send = (data: any) => ws2Messages.push(data);

    room.join(ws1 as any, 'room1');
    room.join(ws2 as any, 'room1');

    room.broadcast('room1', 'Hello Room', ws1 as any);

    // ws1 should not receive (excluded)
    expect(ws1Messages).toHaveLength(0);
    // ws2 should receive
    expect(ws2Messages).toHaveLength(1);
    expect(ws2Messages[0]).toBe('Hello Room');
  });

  it('should broadcast to all rooms', () => {
    let ws1Messages: any[] = [];
    let ws2Messages: any[] = [];

    ws1.send = (data: any) => ws1Messages.push(data);
    ws2.send = (data: any) => ws2Messages.push(data);

    room.join(ws1 as any, 'room1');
    room.join(ws2 as any, 'room2');

    room.broadcastAll('Hello All');

    expect(ws1Messages).toHaveLength(1);
    expect(ws2Messages).toHaveLength(1);
  });

  it('should get list of rooms', () => {
    room.join(ws1 as any, 'room1');
    room.join(ws2 as any, 'room2');

    const rooms = room.getRooms();
    expect(rooms).toContain('room1');
    expect(rooms).toContain('room2');
    expect(rooms).toHaveLength(2);
  });

  it('should cleanup websocket connections', () => {
    room.join(ws1 as any, 'room1');
    room.join(ws1 as any, 'room2');

    room.cleanup(ws1 as any);

    expect(room.getRoomSize('room1')).toBe(0);
    expect(room.getRoomSize('room2')).toBe(0);
  });

  it('should not send to closed connections', () => {
    let sendCount = 0;
    ws1.send = () => sendCount++;
    ws1.readyState = 0; // CLOSED

    room.join(ws1 as any, 'room1');
    room.broadcast('room1', 'test');

    expect(sendCount).toBe(0);
  });
});

describe('wsRoom global instance', () => {
  it('should export a global WebSocketRoom instance', () => {
    expect(wsRoom).toBeInstanceOf(WebSocketRoom);
  });
});
