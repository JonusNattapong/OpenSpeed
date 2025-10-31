import { Request, Response } from 'express';

export function createGCPFunctionHandler(app: any) {
  return async function handler(req: Request, res: Response) {
    try {
      const method = req.method;
      const url = req.url;
      const headers: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k] = Array.isArray(v) ? v.join(',') : (v as string) || undefined;
      }
      const body = req.body ? JSON.stringify(req.body) : undefined;

      const requestLike = { method, url, headers, body };
      const out = await app.handle(requestLike);

      if (!out) {
        res.status(204).end();
        return;
      }

      res.status(out.status || 200);
      if (out.headers) {
        for (const [k, v] of Object.entries(out.headers)) {
          res.setHeader(k, v as string);
        }
      }
      res.send(out.body);
    } catch (err: any) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  };
}