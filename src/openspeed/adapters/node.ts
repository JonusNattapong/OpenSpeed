import http from 'http';
import http2 from 'http2';
import spdy from 'spdy';
import { IncomingMessage, ServerResponse } from 'http';
import type { RequestLike } from '../context.js';

export interface ServerOptions {
  httpVersion?: 'http1' | 'http2' | 'http3';
  ssl?: {
    key: string;
    cert: string;
  };
  compression?: boolean;
  keepAlive?: boolean;
  keepAliveTimeout?: number;
  maxConnections?: number;
  connectionTimeout?: number;
}

export function createNodeServer(app: any, options: ServerOptions = {}) {
  const {
    httpVersion = 'http1',
    ssl,
    compression = true,
    keepAlive = true,
    keepAliveTimeout = 5000,
    maxConnections = 1000,
    connectionTimeout = 60000
  } = options;

  if (httpVersion === 'http2') {
    if (!ssl) {
      throw new Error('SSL certificates are required for HTTP/2');
    }

    return spdy.createServer({
      key: ssl.key,
      cert: ssl.cert,
      spdy: {
        plain: false,
        protocols: ['h2', 'http/1.1'],
        connection: {
          windowSize: 1024 * 1024, // 1MB window size
          autoSpdy31: true,
        },
      },
    }, async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = req.url || '/';
        const method = req.method || 'GET';
        const headers: Record<string, string | string[] | undefined> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          headers[k] = v as any;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks);
        const body = raw.length ? raw.toString() : undefined;

        const request: RequestLike = { method, url, headers, body };
        const out = await app.handle(request);
        if (!out) {
          res.writeHead(204);
          res.end();
          return;
        }
        const status = out.status || 200;
        const outHeaders = out.headers || {};

        // Enable compression if requested
        if (compression) {
          res.setHeader('Content-Encoding', 'gzip');
        }

        res.writeHead(status, outHeaders as any);
        if (out.body !== undefined) res.end(out.body);
        else res.end();
      } catch (err: any) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Internal Server Error');
        console.error(err);
      }
    });
  }

  // HTTP/1.1 (default)
  const server = http.createServer({
    keepAlive,
    keepAliveTimeout,
    maxHeaderSize: 8192,
  }, async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = req.url || '/';
      const method = req.method || 'GET';
      const headers: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k] = v as any;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      const body = raw.length ? raw.toString() : undefined;

      const request: RequestLike = { method, url, headers, body };
      const out = await app.handle(request);
      if (!out) {
        res.writeHead(204);
        res.end();
        return;
      }
      const status = out.status || 200;
      const outHeaders = out.headers || {};

      // Enable compression if requested
      if (compression) {
        res.setHeader('Content-Encoding', 'gzip');
      }

      res.writeHead(status, outHeaders as any);
      if (out.body !== undefined) res.end(out.body);
      else res.end();
    } catch (err: any) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Internal Server Error');
      console.error(err);
    }
  });

  // Configure server settings
  server.timeout = connectionTimeout;
  server.maxConnections = maxConnections;
  server.keepAliveTimeout = keepAliveTimeout;

  return server;
}