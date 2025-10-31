export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    try {
      // Import the app here or pass it somehow
      // For now, assuming app is available globally or injected
      const app = (globalThis as any).app;
      if (!app) {
        return new Response('App not initialized', { status: 500 });
      }

      const url = request.url;
      const method = request.method;
      const headers: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of request.headers) {
        headers[k] = v;
      }
      const body = request.body ? await request.text() : undefined;

      const requestLike = { method, url, headers, body };
      const out = await app.handle(requestLike);

      if (!out) {
        return new Response(null, { status: 204 });
      }

      return new Response(out.body, {
        status: out.status || 200,
        headers: out.headers as Record<string, string>
      });
    } catch (err: any) {
      console.error(err);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'content-type': 'text/plain' }
      });
    }
  }
};