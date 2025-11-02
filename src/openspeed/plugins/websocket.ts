import type { Context } from '../context.js';
import { WebSocket } from 'ws';
import type { OpenSpeedApp } from '../index.js';

export interface WebSocketData {
  [key: string]: unknown;
}

export interface WebSocketHandler {
  message?: (
    ws: WebSocket,
    message: string | Buffer | ArrayBuffer,
    clientInfo: WebSocketClientInfo
  ) => void | Promise<void>;
  open?: (ws: WebSocket, clientInfo: WebSocketClientInfo) => void | Promise<void>;
  close?: (
    ws: WebSocket,
    code: number,
    reason: string,
    clientInfo: WebSocketClientInfo
  ) => void | Promise<void>;
  error?: (ws: WebSocket, error: Error, clientInfo: WebSocketClientInfo) => void | Promise<void>;
  ping?: (ws: WebSocket, data: Buffer, clientInfo: WebSocketClientInfo) => void | Promise<void>;
  pong?: (ws: WebSocket, data: Buffer, clientInfo: WebSocketClientInfo) => void | Promise<void>;
}

export interface WebSocketOptions {
  idleTimeout?: number;
  maxConnections?: number;
  perMessageDeflate?: boolean;
  sendPingsAutomatically?: boolean;
  compression?: boolean;
  // Security options
  allowedOrigins?: string[];
  requireAuth?: boolean;
  maxMessageSize?: number; // Max message size in bytes
  rateLimit?: {
    windowMs: number;
    maxMessages: number;
  };
  requireSecure?: boolean; // Require wss://
  maxConnectionsPerIP?: number;
}

export interface WebSocketClientInfo {
  ip: string;
  userAgent?: string;
  origin?: string;
  authenticated: boolean;
  userId?: string;
  connectionTime: number;
  messageCount: number;
}

export function websocket(path: string, handler: WebSocketHandler, options: WebSocketOptions = {}) {
  // Connection tracking for security
  const activeConnections = new Map<string, WebSocketClientInfo>();
  const connectionsPerIP = new Map<string, number>();
  const messageCounts = new Map<WebSocket, { count: number; resetTime: number }>();

  return (app: OpenSpeedApp) => {
    // Store WebSocket routes separately
    if (!(app as any)._websocketRoutes) {
      (app as any)._websocketRoutes = [];
    }

    (app as any)._websocketRoutes.push({
      path,
      handler,
      options,
      activeConnections,
      connectionsPerIP,
      messageCounts,
    });

    // Add a regular route that will be intercepted by the WebSocket handler
    app.get(path, (ctx: Context) => {
      // Security checks before upgrade
      const clientIP = getClientIP(ctx);
      const origin = ctx.req.headers.origin as string;

      // Check origin
      if (options.allowedOrigins && options.allowedOrigins.length > 0) {
        if (!options.allowedOrigins.includes(origin)) {
          ctx.res.status = 403;
          ctx.res.body = JSON.stringify({ error: 'Origin not allowed' });
          return;
        }
      }

      // Check protocol security
      if (options.requireSecure && !ctx.req.url.startsWith('wss://')) {
        ctx.res.status = 426;
        ctx.res.body = JSON.stringify({ error: 'Secure WebSocket connection required' });
        return;
      }

      // Check connection limits
      const currentConnections = connectionsPerIP.get(clientIP) || 0;
      if (options.maxConnectionsPerIP && currentConnections >= options.maxConnectionsPerIP) {
        ctx.res.status = 429;
        ctx.res.body = JSON.stringify({ error: 'Too many connections from this IP' });
        return;
      }

      // Check global connection limit
      if (options.maxConnections && activeConnections.size >= options.maxConnections) {
        ctx.res.status = 503;
        ctx.res.body = JSON.stringify({ error: 'Server connection limit reached' });
        return;
      }

      // This will be intercepted by the WebSocket upgrade handler
      ctx.res.status = 426;
      ctx.res.body = 'Upgrade Required';
      ctx.res.headers = { ...ctx.res.headers, Upgrade: 'websocket' };
    });
  };
}

// Security utility functions
function getClientIP(ctx: Context): string {
  return (
    ctx.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    ctx.req.headers['x-real-ip']?.toString() ||
    ctx.req.headers['cf-connecting-ip']?.toString() ||
    'unknown'
  );
}

function validateWebSocketMessage(
  ws: WebSocket,
  message: string | Buffer | ArrayBuffer,
  options: WebSocketOptions,
  clientInfo: WebSocketClientInfo,
  messageCounts: Map<WebSocket, { count: number; resetTime: number }>
): boolean {
  // Check message size
  let messageSize = 0;
  if (typeof message === 'string') {
    messageSize = Buffer.byteLength(message, 'utf8');
  } else if (message instanceof Buffer) {
    messageSize = message.length;
  } else if (message instanceof ArrayBuffer) {
    messageSize = message.byteLength;
  }

  if (options.maxMessageSize && messageSize > options.maxMessageSize) {
    console.warn(`[WS SECURITY] Message too large from ${clientInfo.ip}: ${messageSize} bytes`);
    ws.close(1009, 'Message too large'); // 1009 = Too large
    return false;
  }

  // Check rate limiting
  if (options.rateLimit) {
    const now = Date.now();
    const counts = messageCounts.get(ws) || {
      count: 0,
      resetTime: now + options.rateLimit.windowMs,
    };

    // Reset if window expired
    if (counts.resetTime < now) {
      counts.count = 0;
      counts.resetTime = now + options.rateLimit.windowMs;
    }

    if (counts.count >= options.rateLimit.maxMessages) {
      console.warn(`[WS SECURITY] Rate limit exceeded for ${clientInfo.ip}`);
      ws.close(1013, 'Rate limit exceeded'); // 1013 = Try again later
      return false;
    }

    counts.count++;
    messageCounts.set(ws, counts);
  }

  return true;
}

// WebSocket room/broadcast functionality
export class WebSocketRoom {
  private connections = new Map<string, Set<WebSocket>>();
  private connectionRooms = new Map<WebSocket, Set<string>>();
  private roomAuth = new Map<string, Set<string>>(); // room -> allowed user IDs

  join(ws: WebSocket, room: string, userId?: string) {
    // Check room authorization if required
    const allowedUsers = this.roomAuth.get(room);
    if (allowedUsers && userId && !allowedUsers.has(userId)) {
      console.warn(`[WS SECURITY] Unauthorized access to room ${room} by user ${userId}`);
      return false;
    }

    if (!this.connections.has(room)) {
      this.connections.set(room, new Set());
    }
    this.connections.get(room)!.add(ws);

    if (!this.connectionRooms.has(ws)) {
      this.connectionRooms.set(ws, new Set());
    }
    this.connectionRooms.get(ws)!.add(room);

    return true;
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
          try {
            ws.send(message);
          } catch (error) {
            console.error(`[WS] Failed to send message to connection: ${error}`);
            // Remove broken connection
            this.leave(ws, room);
          }
        }
      }
    }
  }

  broadcastAll(message: string | Buffer | ArrayBuffer, exclude?: WebSocket) {
    for (const roomConnections of this.connections.values()) {
      for (const ws of roomConnections) {
        if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(message);
          } catch (error) {
            console.error(`[WS] Failed to send message to connection: ${error}`);
            // Remove broken connection
            this.leave(ws);
          }
        }
      }
    }
  }

  // Room authorization methods
  authorizeRoom(room: string, userIds: string[]) {
    this.roomAuth.set(room, new Set(userIds));
  }

  deauthorizeRoom(room: string, userId: string) {
    const allowedUsers = this.roomAuth.get(room);
    if (allowedUsers) {
      allowedUsers.delete(userId);
      if (allowedUsers.size === 0) {
        this.roomAuth.delete(room);
      }
    }
  }

  getRoomSize(room: string): number {
    return this.connections.get(room)?.size || 0;
  }

  getRooms(): string[] {
    return Array.from(this.connections.keys());
  }

  getAuthorizedUsers(room: string): string[] {
    return Array.from(this.roomAuth.get(room) || []);
  }

  cleanup(ws: WebSocket) {
    this.leave(ws);
  }
}

// Global WebSocket room instance
export const wsRoom = new WebSocketRoom();

// WebSocket security utilities
export function createSecureWebSocketHandler(
  originalHandler: WebSocketHandler,
  options: WebSocketOptions,
  activeConnections: Map<string, WebSocketClientInfo>,
  connectionsPerIP: Map<string, number>,
  messageCounts: Map<WebSocket, { count: number; resetTime: number }>
): WebSocketHandler {
  return {
    open: (ws: WebSocket, clientInfo: WebSocketClientInfo) => {
      // This would be called with client info in the actual implementation
      if (originalHandler.open) {
        originalHandler.open(ws, clientInfo);
      }
    },

    message: (ws: WebSocket, message: string | Buffer | ArrayBuffer) => {
      // Get client info (would be passed from upgrade handler)
      const clientInfo = {
        ip: 'unknown',
        authenticated: false,
        connectionTime: Date.now(),
        messageCount: 0,
      };

      // Validate message
      if (!validateWebSocketMessage(ws, message, options, clientInfo, messageCounts)) {
        return;
      }

      // Update message count
      clientInfo.messageCount++;

      if (originalHandler.message) {
        originalHandler.message(ws, message, clientInfo);
      }
    },

    close: (ws: WebSocket, code: number, reason: string) => {
      // Clean up connection tracking
      const clientIP = 'unknown'; // Would be stored during upgrade
      const currentCount = connectionsPerIP.get(clientIP) || 0;
      if (currentCount > 0) {
        connectionsPerIP.set(clientIP, currentCount - 1);
      }
      activeConnections.delete(`${clientIP}:${Date.now()}`); // Simplified key

      if (originalHandler.close) {
        originalHandler.close(ws, code, reason, {
          ip: clientIP,
          authenticated: false,
          connectionTime: 0,
          messageCount: 0,
        });
      }
    },

    error: (ws: WebSocket, error: Error) => {
      console.error('[WS SECURITY] WebSocket error:', error.message);
      if (originalHandler.error) {
        originalHandler.error(ws, error, {
          ip: 'unknown',
          authenticated: false,
          connectionTime: 0,
          messageCount: 0,
        });
      }
    },

    ping: originalHandler.ping,
    pong: originalHandler.pong,
  };
}

// Cleanup is handled inside the function
