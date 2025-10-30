export function createBunServer(app: any) {
  return {
    listen: (port: number) => {
      Bun.serve({
        port,
        async fetch(req: Request) {
          const url = new URL(req.url);
          const method = req.method;
          const headers: Record<string, string | string[] | undefined> = {};
          for (const [k, v] of req.headers) {
            headers[k] = v;
          }
          const body = req.body ? await req.text() : undefined;

          const request = { method, url: req.url, headers, body };
          const out = await app.handle(request);
          if (!out) return new Response(null, { status: 204 });

          return new Response(out.body, {
            status: out.status || 200,
            headers: out.headers as Record<string, string>
          });
        }
      });
      console.log(`OpenSpeed listening on http://localhost:${port}`);
    }
  };
}