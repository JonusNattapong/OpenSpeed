import { createApp, cors, logger, json, errorHandler } from '../../src/openspeed/index.js';

const app = createApp();

app.use(cors());
app.use(logger());
app.use(json());
app.use(errorHandler());

app.get('/', async (ctx) => {
  return ctx.text('Hello OpenSpeed!');
});

app.get('/user/:id', async (ctx) => {
  return ctx.json({ ok: true, id: ctx.params.id });
});

app.post('/user', async (ctx) => {
  const body = ctx.req.body as any;
  return ctx.json({ created: true, user: body });
});

app.listen(3000);
console.log('OpenSpeed example listening on http://localhost:3000');
