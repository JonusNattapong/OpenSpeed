import { createApp, cors, logger, json, errorHandler, validate, openapi } from '../../src/openspeed/index.js';
import { z } from 'zod';

const app = createApp();

const api = openapi({ title: 'OpenSpeed Example API', version: '1.0.0' });

app.use(api.middleware);
app.use(cors());
app.use(logger());
app.use(json());
app.use(errorHandler());

app.get('/', (ctx) => ctx.text('Hello OpenSpeed!'));
api.collect('GET', '/', 'Get hello message');

app.get('/user/:id', validate({ params: z.object({ id: z.string().min(1) }) }), (ctx) =>
  ctx.json({ ok: true, id: ctx.params.id })
);
api.collect('GET', '/user/:id', 'Get user by ID');

app.get('/openapi.json', (ctx) => {
  ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
  ctx.res.body = JSON.stringify(api.generate(), null, 2);
  return ctx.res;
});

await app.listen(3000);
console.log('OpenSpeed example listening on http://localhost:3000');
console.log('OpenAPI spec at http://localhost:3000/openapi.json');
