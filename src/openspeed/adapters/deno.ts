import type { OpenSpeedApp } from '../index.js';

export function createDenoServer(app: OpenSpeedApp) {
  return {
    listen: (port: number) => {
      Deno.serve({ port }, async (req: Request) => {
        const method = req.method;
        const headers: Record<string, string | string[] | undefined> = {};
        for (const [k, v] of req.headers) {
          headers[k] = v;
        }
        const body = req.body ? await req.text() : undefined;

        const request = { method, url: req.url, headers, body };
        const out = await app.handle(request);
        if (!out) return new Response(null, { status: 204 });

        return new Response(typeof out.body === 'string' ? out.body : JSON.stringify(out.body), {
          status: out.status || 200,
          headers: out.headers as Record<string, string>,
        });
      });
      console.log(`OpenSpeed listening on http://localhost:${port}`);
    },
  };
}
