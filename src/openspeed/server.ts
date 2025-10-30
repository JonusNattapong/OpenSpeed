import http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import type { RequestLike } from './context';

export function createServer(app: any) {
  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = req.url || '/';
      const method = req.method || 'GET';
      const headers: Record<string, any> = {};
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
      res.writeHead(status, outHeaders as any);
      if (out.body !== undefined) res.end(out.body);
      else res.end();
    } catch (err: any) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Internal Server Error');
      console.error(err);
    }
  });
  return server;
}

export default createServer;
