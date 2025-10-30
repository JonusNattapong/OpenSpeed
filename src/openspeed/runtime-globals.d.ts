declare const Bun: {
  serve(options: { port: number; fetch(request: Request): Promise<Response> | Response }): void;
};

declare const Deno: {
  serve(options: { port: number }, handler: (req: Request) => Promise<Response> | Response): void;
};

