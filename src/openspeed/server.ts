import type { RequestLike } from './context.js';
import type { OpenSpeedApp } from './index.js';

export function createServer(app: OpenSpeedApp) {
  // Runtime detection
  if (typeof Bun !== 'undefined' && Bun.serve) {
    // Bun
    return {
      listen: (port: number) => {
        Bun.serve({
          port,
          async fetch(req: Request) {
            const method = req.method;
            const headers: Record<string, string | string[] | undefined> = {};
            for (const [k, v] of req.headers) {
              headers[k] = v;
            }
            const body = req.body ? await req.text() : undefined;

            const request: RequestLike = { method, url: req.url, headers, body };
            const out = await app.handle(request);
            if (!out) return new Response(null, { status: 204 });

            return new Response(
              typeof out.body === 'string' ? out.body : JSON.stringify(out.body),
              {
                status: out.status || 200,
                headers: out.headers as Record<string, string>,
              }
            );
          },
        });
        console.log(`OpenSpeed (Bun) listening on http://localhost:${port}`);
      },
    };
  } else if (typeof Deno !== 'undefined' && Deno.serve) {
    // Deno
    return {
      listen: (port: number) => {
        Deno.serve({ port }, async (req: Request) => {
          const method = req.method;
          const headers: Record<string, string | string[] | undefined> = {};
          for (const [k, v] of req.headers) {
            headers[k] = v;
          }
          const body = req.body ? await req.text() : undefined;

          const request: RequestLike = { method, url: req.url, headers, body };
          const out = await app.handle(request);
          if (!out) return new Response(null, { status: 204 });

          return new Response(typeof out.body === 'string' ? out.body : JSON.stringify(out.body), {
            status: out.status || 200,
            headers: out.headers as Record<string, string>,
          });
        });
        console.log(`OpenSpeed (Deno) listening on http://localhost:${port}`);
      },
    };
  } else {
    // Node.js fallback
    return import('http').then(({ default: http }) => {
      const server = http.createServer(async (req: any, res: any) => {
        try {
          const url = req.url || '/';
          const method = req.method || 'GET';
          const headers: Record<string, string | string[] | undefined> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            headers[k] = v as string | string[] | undefined;
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
          res.writeHead(status, outHeaders);
          if (out.body !== undefined) res.end(out.body);
          else res.end();
        } catch (err: unknown) {
          res.writeHead(500, { 'content-type': 'text/plain' });
          res.end('Internal Server Error');
          console.error(err);
        }
      });
      return server;
    });
  }
}

export default createServer;
