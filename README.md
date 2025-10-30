# OpenSpeed (prototype)

Minimal prototype for a high-performance, developer-friendly web framework inspired by Hono and Elysia.

What is included in this prototype:

- A trie-based router with parameter support (src/openspeed/router.ts)
- Minimal Context and response helpers (src/openspeed/context.ts)
- App API with middleware and method helpers (src/openspeed/index.ts)
- A Node HTTP adapter (src/openspeed/server.ts)
- Official plugins: CORS, logger, JSON body parser, error handler (src/openspeed/plugins/)
- An example app using plugins (examples/hello-openspeed)

How to run (local development):

1. Install dependencies:

```powershell
npm install
```

2. Run example in dev (requires ts-node-esm or ts-node):

```powershell
npm run dev
```

3. Benchmark with autocannon (start server first):

## Benchmarks

Preliminary benchmark on Node.js 22 (100 connections, 10s):

- **~3,482 req/sec** average
- **28.21 ms** avg latency
- **1.34 MB/sec** throughput

Run `npm run benchmark` to test locally.

Comparison targets:
- Hono (Bun): ~300k req/sec
- Elysia (Bun): ~400k req/sec
- OpenSpeed (Node): ~3.5k req/sec (prototype, room for optimization)

## Plugins

OpenSpeed includes official plugins for common web development tasks:

- **CORS** (`cors(options?)`): Handles CORS headers and preflight requests
- **Logger** (`logger(options?)`): Logs request/response times
- **JSON Body Parser** (`json(options?)`): Parses JSON request bodies
- **Error Handler** (`errorHandler(options?)`): Catches errors and returns 500 responses
- **Validate** (`validate(options?)`): Zod-based validation for body, params, query, headers
- **OpenAPI** (`openapi(options?)`): Auto-generates OpenAPI spec from collected routes

Example usage:

```ts
import { createApp, cors, logger, json, errorHandler, validate, openapi } from 'openspeed';
import { z } from 'zod';

const app = createApp();
const api = openapi({ title: 'My API', version: '1.0.0' });

app.use(cors({ origin: '*' }));
app.use(logger());
app.use(json());
app.use(errorHandler());

app.get('/user/:id', validate({ params: z.object({ id: z.string() }) }), (ctx) => {
  return ctx.json({ id: ctx.params.id });
});
api.collect('GET', '/user/:id', 'Get user by ID');

app.get('/openapi.json', (ctx) => ctx.json(api.generate()));
```

Notes:
- This is a minimal prototype to explore architecture and DX. Next steps: add type inference, typed routes, benchmarks comparing Bun and Node, Web Standard adapters, CLI scaffolding, and production build.
