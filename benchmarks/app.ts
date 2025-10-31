import { createApp, cors, json } from '../dist/src/openspeed/index.js';
import type { Context } from '../dist/src/openspeed/context.js';

const app = createApp();

app.use(cors());
app.use(json());

// GraphQL schema
const typeDefs = `
  type Query {
    hello: String
    user(id: ID!): User
    users: [User]
  }

  type Mutation {
    createUser(name: String!, email: String!): User
  }

  type User {
    id: ID!
    name: String!
    email: String!
  }
`;

// Resolvers
const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    user: (_: any, { id }: { id: string }) => ({
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
    }),
    users: () => [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
    ],
  },
  Mutation: {
    createUser: (_: any, { name, email }: { name: string; email: string }) => ({
      id: Math.random().toString(),
      name,
      email,
    }),
  },
};

// app.use(graphql({
//   schema: typeDefs,
//   resolvers,
//   endpoint: '/graphql',
// }));

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
app.listen(3007);