/**
 * Complete Features Example for OpenSpeed
 * Demonstrates: JSX, SSG, RPC, Streaming, and Enhanced Validation
 */

import { Openspeed } from '../../src/openspeed/index.js';
import {
  jsxPlugin,
  jsx,
  Layout,
  H1,
  H2,
  P,
  Div,
  A,
  Ul,
  Li,
  ssg,
  defineRoutes,
  generateStatic,
  rpc,
  treaty,
  stream,
  fromArray,
  pipe,
  filter,
  validate,
  createValidatedHandler,
  logger,
  cors,
} from '../../src/openspeed/plugins/index.js';
import { z } from 'zod';
import type { Context } from '../../src/openspeed/context.js';

// Create app
const app = Openspeed();

// Use plugins
app.use(logger());
app.use(cors());
app.use(jsxPlugin({ pretty: true, doctype: true }));
app.use(rpc({ enableIntrospection: true }));
app.use(stream());
app.use(
  ssg({
    outputDir: './examples/complete-features/dist',
    routes: defineRoutes(['/', '/about', '/docs']),
  })
);

// ============================
// 1. JSX Routes
// ============================

// Home page with JSX
app.get('/', (ctx: any) => {
  return ctx.jsx(
    jsx(
      Layout,
      { title: 'OpenSpeed - Complete Features Demo' },
      jsx(
        Div,
        { className: 'container' },
        jsx(H1, {}, 'Welcome to OpenSpeed! 🚀'),
        jsx(P, {}, 'A high-performance web framework with complete feature set.'),
        jsx(H2, {}, 'Features Demonstrated:'),
        jsx(
          Ul,
          {},
          jsx(Li, {}, jsx(A, { href: '/jsx-demo' }, 'JSX Rendering')),
          jsx(Li, {}, jsx(A, { href: '/stream-demo' }, 'Streaming Responses')),
          jsx(Li, {}, jsx(A, { href: '/sse-demo' }, 'Server-Sent Events')),
          jsx(Li, {}, jsx(A, { href: '/api/users' }, 'RPC API with Type Safety')),
          jsx(Li, {}, jsx(A, { href: '/api/validated' }, 'Enhanced Validation (Zod)')),
          jsx(Li, {}, 'Static Site Generation (build with SSG)')
        )
      )
    )
  );
});

// JSX demo page
app.get('/jsx-demo', (ctx: any) => {
  const items = ['Fast', 'Type-Safe', 'Ergonomic', 'Production-Ready'];

  return ctx.jsx(
    jsx(
      Layout,
      { title: 'JSX Demo' },
      jsx(
        Div,
        { className: 'demo' },
        jsx(H1, {}, 'JSX Rendering Demo'),
        jsx(P, {}, 'OpenSpeed supports JSX just like Hono!'),
        jsx(H2, {}, 'Key Features:'),
        jsx(Ul, {}, ...items.map((item) => jsx(Li, {}, item))),
        jsx(A, { href: '/' }, '← Back to Home')
      )
    )
  );
});

// About page (for SSG)
app.get('/about', (ctx: any) => {
  return ctx.jsx(
    jsx(
      Layout,
      { title: 'About OpenSpeed' },
      jsx(
        Div,
        {},
        jsx(H1, {}, 'About OpenSpeed'),
        jsx(P, {}, 'OpenSpeed is a high-performance web framework inspired by Hono and Elysia.'),
        jsx(H2, {}, 'Performance'),
        jsx(P, {}, '2x-3x faster than competitors with ML-powered optimization.'),
        jsx(A, { href: '/' }, '← Back to Home')
      )
    )
  );
});

// Docs page (for SSG)
app.get('/docs', (ctx: any) => {
  return ctx.jsx(
    jsx(
      Layout,
      { title: 'Documentation' },
      jsx(
        Div,
        {},
        jsx(H1, {}, 'OpenSpeed Documentation'),
        jsx(H2, {}, 'Getting Started'),
        jsx(P, {}, 'Install OpenSpeed: npm install openspeed'),
        jsx(H2, {}, 'Features'),
        jsx(
          Ul,
          {},
          jsx(Li, {}, 'JSX Support'),
          jsx(Li, {}, 'Static Site Generation'),
          jsx(Li, {}, 'RPC with Type Safety'),
          jsx(Li, {}, 'Streaming Responses'),
          jsx(Li, {}, 'Multiple Validators (Zod, Valibot, etc.)')
        ),
        jsx(A, { href: '/' }, '← Back to Home')
      )
    )
  );
});

// ============================
// 2. Streaming Routes
// ============================

// Basic streaming with generator
app.get('/stream-demo', (ctx: any) => {
  return ctx.stream(
    (async function* () {
      yield 'Hello ';
      await new Promise((r) => setTimeout(r, 500));
      yield 'from ';
      await new Promise((r) => setTimeout(r, 500));
      yield 'OpenSpeed ';
      await new Promise((r) => setTimeout(r, 500));
      yield 'streaming! 🎉';
    })()
  );
});

// Server-Sent Events
app.get('/sse-demo', (ctx: any) => {
  return ctx.streamSSE(
    (async function* () {
      let count = 0;
      while (count < 10) {
        yield {
          event: 'counter',
          data: { count, timestamp: new Date().toISOString() },
        };
        await new Promise((r) => setTimeout(r, 1000));
        count++;
      }
      yield { event: 'done', data: 'Stream complete!' };
    })(),
    { retry: 3000, keepAlive: 30000 }
  );
});

// JSON streaming (NDJSON)
app.get('/stream-json', (ctx: any) => {
  return ctx.streamJSON(
    (async function* () {
      for (let i = 0; i < 20; i++) {
        yield { id: i, value: Math.random(), timestamp: Date.now() };
        await new Promise((r) => setTimeout(r, 100));
      }
    })()
  );
});

// Advanced streaming with transformations
app.get('/stream-advanced', (ctx: any) => {
  const numbers = async function* () {
    for (let i = 1; i <= 100; i++) {
      yield i;
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  // Filter even numbers and double them
  const evens = filter(numbers(), (n) => n % 2 === 0);
  const doubled = pipe(evens, (n) => n * 2);

  return ctx.streamJSON(doubled);
});

// ============================
// 3. RPC API Routes with Type Safety
// ============================

// User API with Zod validation
const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
});

app.post(
  '/api/users',
  validate({
    body: userSchema,
  }),
  (ctx: Context) => {
    const user = ctx.getBody();
    return ctx.json({
      id: Math.random().toString(36).substr(2, 9),
      ...user,
      createdAt: new Date().toISOString(),
    });
  }
);

// Get user by ID
app.get('/api/users/:id', (ctx: Context) => {
  const id = ctx.getParam('id');
  return ctx.json({
    id,
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
  });
});

// Enhanced validation demo with multiple validators
app.post(
  '/api/validated',
  validate({
    body: z.object({
      title: z.string(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    query: z.object({
      format: z.enum(['json', 'html']).optional(),
    }),
  }),
  (ctx) => {
    const body = ctx.getBody();
    const query = ctx.req.query;

    return ctx.json({
      success: true,
      data: body,
      format: query?.format || 'json',
    });
  }
);

// Batch API endpoint
app.post('/api/batch', async (ctx: Context) => {
  const requests = ctx.getBody();

  if (!Array.isArray(requests)) {
    return ctx.json({ error: 'Expected array of requests' }, 400);
  }

  const results = await Promise.all(
    requests.map(async (req) => {
      try {
        return { success: true, data: req };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    })
  );

  return ctx.json({ results });
});

// ============================
// 4. Data API for demonstration
// ============================

// Products list
app.get('/api/products', (ctx: Context) => {
  const products = [
    { id: 1, name: 'Product A', price: 29.99 },
    { id: 2, name: 'Product B', price: 49.99 },
    { id: 3, name: 'Product C', price: 19.99 },
  ];

  return ctx.json(products);
});

// Search with query validation
app.get(
  '/api/search',
  validate({
    query: z.object({
      q: z.string().min(1),
      limit: z.string().regex(/^\d+$/).transform(Number).optional(),
      offset: z.string().regex(/^\d+$/).transform(Number).optional(),
    }),
  }),
  (ctx) => {
    const { q, limit = 10, offset = 0 } = ctx.req.query || {};

    return ctx.json({
      query: q,
      results: [
        { id: 1, title: `Result for ${q} - 1` },
        { id: 2, title: `Result for ${q} - 2` },
      ],
      pagination: { limit, offset },
    });
  }
);

// ============================
// 5. Health & Status
// ============================

app.get('/health', (ctx: Context) => {
  return ctx.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/status', (ctx: Context) => {
  return ctx.json({
    version: '1.0.0',
    features: [
      'JSX Rendering',
      'Static Site Generation',
      'RPC Type Safety',
      'Streaming (Generator & SSE)',
      'Enhanced Validation (Zod, Valibot, etc.)',
      'OpenTelemetry Support',
    ],
  });
});

// ============================
// 6. Static files (if needed)
// ============================

// app.use(serveStatic({ root: './public', prefix: '/static' }));

// ============================
// Start Server
// ============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║  🚀 OpenSpeed - Complete Features Demo                   ║
║                                                           ║
║  Server running on: http://localhost:${PORT}               ║
║                                                           ║
║  Routes:                                                  ║
║  • GET  /                    - Home (JSX)                ║
║  • GET  /jsx-demo            - JSX Demo                  ║
║  • GET  /about               - About (SSG ready)         ║
║  • GET  /docs                - Docs (SSG ready)          ║
║  • GET  /stream-demo         - Streaming demo            ║
║  • GET  /sse-demo            - Server-Sent Events        ║
║  • GET  /stream-json         - JSON streaming            ║
║  • GET  /stream-advanced     - Advanced streaming        ║
║  • POST /api/users           - Create user (validated)   ║
║  • GET  /api/users/:id       - Get user                  ║
║  • POST /api/validated       - Validation demo           ║
║  • GET  /api/products        - Products list             ║
║  • GET  /api/search          - Search (with validation)  ║
║  • GET  /health              - Health check              ║
║  • GET  /__rpc/introspect    - RPC introspection         ║
║                                                           ║
║  Features demonstrated:                                   ║
║  ✓ JSX Rendering (like Hono)                             ║
║  ✓ Static Site Generation                                ║
║  ✓ RPC with Type Safety (like Elysia)                    ║
║  ✓ Streaming (Generator & SSE)                           ║
║  ✓ Enhanced Validation (Zod support)                     ║
║                                                           ║
║  To generate static site:                                ║
║  $ npm run build                                         ║
║  $ node examples/complete-features/generate-ssg.js       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Export app type for RPC client
export type App = typeof app;
export { app };
