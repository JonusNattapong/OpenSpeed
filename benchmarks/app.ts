import { createApp, cors, json } from '../src/openspeed/index.js';

const app = createApp();

app.use(cors());
app.use(json());

app.get('/', (ctx) => {
  return ctx.text('Hello OpenSpeed');
});

app.get('/json', (ctx) => {
  return ctx.json({ message: 'Hello OpenSpeed', timestamp: Date.now() });
});

app.post('/json', (ctx) => {
  return ctx.json({ received: ctx.req.body });
});

app.listen(3000);