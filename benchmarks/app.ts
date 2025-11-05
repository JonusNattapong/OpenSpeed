import { createApp } from '../src/openspeed/index.js';
import type { Context } from '../src/openspeed/context.js';

const app = createApp();

app.get('/', (ctx: Context) => {
  return ctx.text('Hello OpenSpeed');
});

app.get('/json', (ctx: Context) => {
  return ctx.json({ message: 'Hello OpenSpeed', timestamp: Date.now() });
});

app.post('/json', (ctx: Context) => {
  return ctx.json({ received: ctx.req.body });
});

console.log('Starting server...');
app.listen(3001);
