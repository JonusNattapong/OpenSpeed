import type { Context } from '../context.js';

export interface WebSocketData {
  [key: string]: any;
}

export interface WebSocketHandler {
  message?: (ws: WebSocket, message: string | Buffer | ArrayBuffer) => void | Promise<void>;
  open?: (ws: WebSocket) => void | Promise<void>;
  close?: (ws: WebSocket, code: number, reason: string) => void | Promise<void>;
  error?: (ws: WebSocket, error: Error) => void | Promise<void>;
  ping?: (ws: WebSocket, data: Buffer) => void | Promise<void>;
  pong?: (ws: WebSocket, data: Buffer) => void | Promise<void>;
}

export interface WebSocketOptions {
  idleTimeout?: number;
  maxConnections?: number;
  perMessageDeflate?: boolean;
  sendPingsAutomatically?: boolean;
  compression?: boolean;
}

export function websocket(path: string, handler: WebSocketHandler, options: WebSocketOptions = {}) {
  return (app: any) => {
    // Store WebSocket routes separately
    if (!app._websocketRoutes) {
      app._websocketRoutes = [];
    }

    app._websocketRoutes.push({
      path,
      handler,
      options
    });

    // Add a regular route that will be intercepted by the WebSocket handler
    app.get(path, (ctx: Context) => {
      // This will be intercepted by the WebSocket upgrade handler
      ctx.res.status = 426;
      ctx.res.body = 'Upgrade Required';
      ctx.res.headers = { ...ctx.res.headers, 'Upgrade': 'websocket' };
    });
  };
}

// WebSocket room/broadcast functionality
export class WebSocketRoom {
  private connections = new Map<string, Set<WebSocket>>();
  private connectionRooms = new Map<WebSocket, Set<string>>();

  join(ws: WebSocket, room: string) {
    if (!this.connections.has(room)) {
      this.connections.set(room, new Set());
    }
    this.connections.get(room)!.add(ws);

    if (!this.connectionRooms.has(ws)) {
      this.connectionRooms.set(ws, new Set());
    }
    this.connectionRooms.get(ws)!.add(room);
  }

  leave(ws: WebSocket, room?: string) {
    if (room) {
      const roomConnections = this.connections.get(room);
      if (roomConnections) {
        roomConnections.delete(ws);
        if (roomConnections.size === 0) {
          this.connections.delete(room);
        }
      }

      const wsRooms = this.connectionRooms.get(ws);
      if (wsRooms) {
        wsRooms.delete(room);
      }
    } else {
      // Leave all rooms
      const wsRooms = this.connectionRooms.get(ws);
      if (wsRooms) {
        for (const r of wsRooms) {
          const roomConnections = this.connections.get(r);
          if (roomConnections) {
            roomConnections.delete(ws);
            if (roomConnections.size === 0) {
              this.connections.delete(r);
            }
          }
        }
        this.connectionRooms.delete(ws);
      }
    }
  }

  broadcast(room: string, message: string | Buffer | ArrayBuffer, exclude?: WebSocket) {
    const roomConnections = this.connections.get(room);
    if (roomConnections) {
      for (const ws of roomConnections) {
        if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  }

  broadcastAll(message: string | Buffer | ArrayBuffer, exclude?: WebSocket) {
    for (const roomConnections of this.connections.values()) {
      for (const ws of roomConnections) {
        if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  }

  getRoomSize(room: string): number {
    return this.connections.get(room)?.size || 0;
  }

  getRooms(): string[] {
    return Array.from(this.connections.keys());
  }

  cleanup(ws: WebSocket) {
    this.leave(ws);
  }
}

// Global WebSocket room instance
export const wsRoom = new WebSocketRoom();