<file_path>
OpenSpeed\examples\graphql-api\README.md
</file_path>

<edit_description>
Create comprehensive README for the GraphQL API example
</edit_description>

# OpenSpeed GraphQL API Example

This example demonstrates OpenSpeed's comprehensive GraphQL integration, showcasing modern GraphQL best practices with high-performance backend capabilities.

## 🚀 Features

- **Schema-First Development** - Define GraphQL schemas with auto-generated resolvers
- **DataLoader Integration** - Efficient batching and caching for N+1 query problems
- **Real-Time Subscriptions** - WebSocket-based subscriptions for live updates
- **Type Generation** - Auto-generate TypeScript types from GraphQL schema
- **Interactive Playground** - Built-in GraphQL Playground for development
- **Custom Scalars** - Support for DateTime and other custom types
- **Advanced Error Handling** - Structured error responses with extensions
- **Relationship Batching** - Optimized resolvers for complex relationships

## 📁 Project Structure

```
examples/graphql-api/
├── index.ts              # Main application with GraphQL setup
├── README.md            # This documentation
└── schema/              # (Future) Schema files for code generation
    └── types.ts         # Auto-generated TypeScript types
```

## 🛠 Getting Started

### Prerequisites
- Node.js 20+
- pnpm

### Installation
```bash
cd examples/graphql-api
pnpm install
```

### Running the Example
```bash
# Development mode (with GraphQL Playground)
pnpm dev

# Production mode
pnpm start
```

The server will start on `http://localhost:3000`

## 🌐 API Endpoints

### GraphQL Endpoints
- `POST /graphql` - GraphQL queries and mutations
- `GET /graphql` - Interactive GraphQL Playground
- `WS /graphql/subscriptions` - WebSocket subscriptions

### REST API (Comparison)
- `GET /api/users` - List users (REST fallback)
- `GET /api/posts` - List posts (REST fallback)

### Info Endpoints
- `GET /` - API information and example queries
- `GET /health` - Server health check

## 📋 GraphQL Schema

### Types

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  role: UserRole!
  posts: [Post!]!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments: [Comment!]!
  publishedAt: DateTime
  status: PostStatus!
}

type Comment {
  id: ID!
  content: String!
  author: User!
  post: Post!
  createdAt: DateTime!
}

type Stats {
  totalUsers: Int!
  totalPosts: Int!
  totalComments: Int!
  postsPublishedToday: Int!
}
```

### Enums

```graphql
enum UserRole {
  ADMIN
  MODERATOR
  USER
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### Custom Scalars

```graphql
scalar DateTime
```

## 🔍 Example Queries

### Get Users with Posts
```graphql
query GetUsers {
  users(limit: 5) {
    id
    name
    email
    role
    posts {
      id
      title
      publishedAt
    }
  }
}
```

### Get Single Post with Comments
```graphql
query GetPost($id: ID!) {
  post(id: $id) {
    id
    title
    content
    author {
      name
      email
    }
    comments {
      content
      author {
        name
      }
      createdAt
    }
    publishedAt
    status
  }
}
```

### Create User
```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    name
    email
    role
  }
}

# Variables:
{
  "input": {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER"
  }
}
```

### Create Post with Comment
```graphql
mutation CreatePostAndComment($postInput: CreatePostInput!, $commentInput: CreateCommentInput!) {
  createPost(input: $postInput) {
    id
    title
  }
  createComment(input: $commentInput) {
    id
    content
  }
}
```

### Get Statistics
```graphql
query GetStats {
  stats {
    totalUsers
    totalPosts
    totalComments
    postsPublishedToday
  }
}
```

### Real-Time Subscriptions

#### Subscribe to New Users
```graphql
subscription OnUserCreated {
  userCreated {
    id
    name
    email
    role
  }
}
```

#### Subscribe to New Posts
```graphql
subscription OnPostCreated {
  postCreated {
    id
    title
    author {
      name
    }
    publishedAt
  }
}
```

#### Subscribe to Comments on Specific Post
```graphql
subscription OnCommentAdded($postId: ID!) {
  commentAdded(postId: $postId) {
    id
    content
    author {
      name
    }
    post {
      title
    }
    createdAt
  }
}
```

## ⚡ Performance Features

### DataLoader Integration

The API uses DataLoader for efficient batching and caching:

```typescript
// Batch load users by IDs
const userLoader = createDataLoader(async (ids: readonly string[]) => {
  const userMap = new Map(users.map(user => [user.id, user]));
  return ids.map(id => userMap.get(id) || null);
});

// Batch load posts by user IDs
const userPostsLoader = createDataLoader(async (userIds: readonly string[]) => {
  const postsByUser = new Map<string, any[]>();
  // Group posts by author
  return userIds.map(id => postsByUser.get(id) || []);
});
```

### Relationship Batching

Complex relationships are resolved efficiently:

```typescript
User: {
  posts: createLoaderResolver('userPosts', (user: any) => user.id),
},

Post: {
  author: createLoaderResolver('user', (post: any) => post.authorId),
  comments: createLoaderResolver('postComments', (post: any) => post.id),
},
```

## 🔧 Advanced Configuration

### Custom Context

```typescript
context: (ctx: Context) => ({
  userId: ctx.req.headers.authorization?.replace('Bearer ', ''),
  requestId: Math.random().toString(36).substring(2, 15),
})
```

### Error Formatting

```typescript
formatError: (error) => ({
  message: error.message,
  locations: error.locations,
  path: error.path,
  extensions: {
    code: error.extensions?.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  },
})
```

### Validation Rules

```typescript
validationRules: [
  // Custom validation rules
  (context) => ({
    Field(node) {
      // Custom field validation
    }
  })
]
```

## 🧪 Testing

### Manual Testing with GraphQL Playground

1. Open `http://localhost:3000/graphql` in your browser
2. Use the examples above to test queries and mutations
3. Monitor the Network tab for efficient batching

### Load Testing

```bash
# Install autocannon
npm install -g autocannon

# Test GraphQL endpoint
autocannon -c 50 -d 10 \
  -H "Content-Type: application/json" \
  -m POST \
  --body '{"query": "query { users { id name } }"}' \
  http://localhost:3000/graphql
```

### Subscription Testing

```javascript
// WebSocket client example
const ws = new WebSocket('ws://localhost:3000/graphql/subscriptions');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'start',
    id: '1',
    payload: {
      query: 'subscription { userCreated { id name } }'
    }
  }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

## 📊 Performance Comparison

### REST API vs GraphQL

| Feature | REST API | GraphQL API |
|---------|----------|-------------|
| Over-fetching | ❌ Common | ✅ Exact data |
| Under-fetching | ❌ Multiple requests | ✅ Single request |
| API Evolution | ❌ Breaking changes | ✅ Backward compatible |
| Documentation | ❌ Manual | ✅ Auto-generated |
| Real-time | ❌ Polling | ✅ Subscriptions |
| Batching | ❌ Manual | ✅ Automatic |

### DataLoader Benefits

- **N+1 Query Problem**: Solved with automatic batching
- **Caching**: Built-in request-level caching
- **Memory Efficiency**: Prevents duplicate data loading
- **Database Optimization**: Reduces round trips

## 🔒 Security Features

### Authentication Context
```typescript
context: (ctx: Context) => ({
  userId: extractUserIdFromToken(ctx.req.headers.authorization),
  permissions: getUserPermissions(userId),
})
```

### Field-Level Authorization
```typescript
User: {
  email: (user, args, context) => {
    // Only allow users to see their own email or admins
    if (context.userId === user.id || context.permissions.includes('ADMIN')) {
      return user.email;
    }
    return null;
  }
}
```

### Rate Limiting
```typescript
// Apply rate limiting middleware before GraphQL
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
}));
```

## 🚀 Production Deployment

### Environment Variables
```bash
NODE_ENV=production
PORT=3000
GRAPHQL_PLAYGROUND=false  # Disable playground in production
```

### Build Process
```bash
# Build the application
pnpm build

# Generate TypeScript types from schema
pnpm generate-types

# Start production server
pnpm start
```

### Monitoring
```typescript
// Add monitoring middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;

  // Log GraphQL operations
  if (ctx.req.url.includes('/graphql')) {
    console.log(`GraphQL operation took ${duration}ms`);
  }

  return result;
});
```

## 📚 Learn More

### GraphQL Concepts
- [GraphQL Official Documentation](https://graphql.org/learn/)
- [DataLoader](https://github.com/graphql/dataloader)
- [GraphQL Subscriptions](https://www.apollographql.com/docs/react/data/subscriptions/)

### OpenSpeed Features
- [File-Based Routing](../file-based-routing/README.md)
- [Plugin System](../../docs/plugins.md)
- [Performance Optimization](../../docs/performance.md)

## 🤝 Contributing

Found an issue or want to improve the GraphQL integration?

1. Test the examples in the GraphQL Playground
2. Check existing issues in the repository
3. Submit a pull request with improvements
4. Add tests for new features

---

Built with ❤️ using OpenSpeed's GraphQL integration - combining the best of REST API performance with GraphQL's flexibility and type safety.