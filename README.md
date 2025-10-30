# Nova (prototype)

Minimal prototype for a high-performance, developer-friendly web framework inspired by Hono and Elysia.

What is included in this prototype:

- A trie-based router with parameter support (src/nova/router.ts)
- Minimal Context and response helpers (src/nova/context.ts)
- App API with middleware and method helpers (src/nova/index.ts)
- A Node HTTP adapter (src/nova/server.ts)
- Official plugins: CORS, logger, JSON body parser, error handler (src/nova/plugins/)
- An example app using plugins (examples/hello-nova)

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

```powershell
npm run benchmark
```

## Plugins

Nova includes official plugins for common web development tasks:

- **CORS** (`cors(options?)`): Handles CORS headers and preflight requests
- **Logger** (`logger(options?)`): Logs request/response times
- **JSON Body Parser** (`json(options?)`): Parses JSON request bodies
- **Error Handler** (`errorHandler(options?)`): Catches errors and returns 500 responses

Example usage:

```ts
import { createApp, cors, logger, json, errorHandler } from 'nova';

const app = createApp();

app.use(cors({ origin: '*' }));
app.use(logger());
app.use(json());
app.use(errorHandler());

app.post('/api/users', (ctx) => {
  const data = ctx.req.body; // parsed JSON
  return ctx.json({ success: true });
});
```

Notes:
- This is a minimal prototype to explore architecture and DX. Next steps: add type inference, schema validation, typed routes, benchmarks comparing Bun and Node, Web Standard adapters, and a build for ESM runtime targets.
