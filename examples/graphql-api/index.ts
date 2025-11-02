/**
 * GraphQL API Example - OpenSpeed
 *
 * This example demonstrates OpenSpeed's comprehensive GraphQL integration:
 * - Schema-first development with auto-generated resolvers
 * - DataLoader integration for efficient batching and caching
 * - Real-time subscriptions with WebSocket support
 * - Type generation from GraphQL schema
 * - Interactive GraphQL Playground
 * - Advanced features like custom scalars and directives
 */

import { createApp } from '../../src/openspeed/index.js';
import { graphqlPlugin, GraphQLSchemaBuilder, TypeGenerator, createDataLoader, createLoaderResolver } from '../../src/openspeed/plugins/graphql.js';
import type { Context } from '../../src/openspeed/context.js';

// Mock data stores
const users = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'ADMIN' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'USER' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'USER' },
  { id: '4', name: 'Diana Prince', email: 'diana@example.com', role: 'MODERATOR' },
];

const posts = [
  { id: '1', title: 'Getting Started with GraphQL', content: 'GraphQL is awesome...', authorId: '1', publishedAt: '2024-01-15T10:00:00Z' },
  { id: '2', title: 'OpenSpeed Framework Guide', content: 'Learn about OpenSpeed...', authorId: '1', publishedAt: '2024-01-20T14:30:00Z' },
  { id: '3', title: 'TypeScript Best Practices', content: 'Tips for TypeScript...', authorId: '2', publishedAt: '2024-01-18T09:15:00Z' },
  { id: '4', title: 'API Design Patterns', content: 'Common patterns for APIs...', authorId: '3', publishedAt: '2024-01-22T16:45:00Z' },
];

const comments = [
  { id: '1', content: 'Great article!', postId: '1', authorId: '2', createdAt: '2024-01-15T11:00:00Z' },
  { id: '2', content: 'Very helpful!', postId: '1', authorId: '3', createdAt: '2024-01-15T12:00:00Z' },
  { id: '3', content: 'Thanks for sharing', postId: '2', authorId: '4', createdAt: '2024-01-20T15:00:00Z' },
];

// GraphQL Schema Definition (Schema-first approach)
const typeDefs = `
  # Custom scalar for DateTime
  scalar DateTime

  # Enums
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

  # Types
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

  # Input types for mutations
  input CreateUserInput {
    name: String!
    email: String!
    role: UserRole
  }

  input CreatePostInput {
    title: String!
    content: String!
    authorId: ID!
  }

  input CreateCommentInput {
    content: String!
    postId: ID!
    authorId: ID!
  }

  # Queries
  type Query {
    # User queries
    users(limit: Int, offset: Int): [User!]!
    user(id: ID!): User

    # Post queries
    posts(limit: Int, offset: Int): [Post!]!
    post(id: ID!): Post

    # Comment queries
    comments(postId: ID): [Comment!]!

    # Meta queries
    stats: Stats!
  }

  # Mutations
  type Mutation {
    createUser(input: CreateUserInput!): User!
    createPost(input: CreatePostInput!): Post!
    createComment(input: CreateCommentInput!): Comment!

    updateUser(id: ID!, name: String, email: String, role: UserRole): User
    deleteUser(id: ID!): Boolean!

    publishPost(id: ID!): Post
    deletePost(id: ID!): Boolean!
  }

  # Subscriptions for real-time updates
  type Subscription {
    userCreated: User!
    postCreated: Post!
    commentAdded(postId: ID): Comment!
  }

  # Statistics
  type Stats {
    totalUsers: Int!
    totalPosts: Int!
    totalComments: Int!
    postsPublishedToday: Int!
  }
`;

// DataLoader definitions for efficient batching
const userLoader = createDataLoader(async (ids: readonly string[]) => {
  const userMap = new Map(users.map(user => [user.id, user]));
  return ids.map(id => userMap.get(id) || null);
});

const postLoader = createDataLoader(async (ids: readonly string[]) => {
  const postMap = new Map(posts.map(post => [post.id, post]));
  return ids.map(id => postMap.get(id) || null);
});

const commentLoader = createDataLoader(async (ids: readonly string[]) => {
  const commentMap = new Map(comments.map(comment => [comment.id, comment]));
  return ids.map(id => commentMap.get(id) || null);
});

// Batch loaders for relationships
const userPostsLoader = createDataLoader(async (userIds: readonly string[]) => {
  const postsByUser = new Map<string, any[]>();
  userIds.forEach(id => postsByUser.set(id, []));

  posts.forEach(post => {
    if (postsByUser.has(post.authorId)) {
      postsByUser.get(post.authorId)!.push(post);
    }
  });

  return userIds.map(id => postsByUser.get(id) || []);
});

const postCommentsLoader = createDataLoader(async (postIds: readonly string[]) => {
  const commentsByPost = new Map<string, any[]>();
  postIds.forEach(id => commentsByPost.set(id, []));

  comments.forEach(comment => {
    if (commentsByPost.has(comment.postId)) {
      commentsByPost.get(comment.postId)!.push(comment);
    }
  });

  return postIds.map(id => commentsByPost.get(id) || []);
});

// Resolvers
const resolvers = {
  // Custom scalar resolvers
  DateTime: {
    parseValue: (value: string) => new Date(value),
    serialize: (value: Date) => value.toISOString(),
    parseLiteral: (ast: any) => ast.kind === 'StringValue' ? new Date(ast.value) : null,
  },

  // Query resolvers
  Query: {
    users: (_: any, { limit = 10, offset = 0 }: { limit: number; offset: number }) => {
      return users.slice(offset, offset + limit);
    },

    user: createLoaderResolver('user', (_: any, { id }: { id: string }) => id),

    posts: (_: any, { limit = 10, offset = 0 }: { limit: number; offset: number }) => {
      return posts.slice(offset, offset + limit);
    },

    post: createLoaderResolver('post', (_: any, { id }: { id: string }) => id),

    comments: (_: any, { postId }: { postId?: string }) => {
      if (postId) {
        return comments.filter(comment => comment.postId === postId);
      }
      return comments;
    },

    stats: () => {
      const today = new Date().toISOString().split('T')[0];
      const postsPublishedToday = posts.filter(post =>
        post.publishedAt && post.publishedAt.startsWith(today)
      ).length;

      return {
        totalUsers: users.length,
        totalPosts: posts.length,
        totalComments: comments.length,
        postsPublishedToday,
      };
    },
  },

  // Mutation resolvers
  Mutation: {
    createUser: (_: any, { input }: { input: any }) => {
      const newUser = {
        id: String(users.length + 1),
        name: input.name,
        email: input.email,
        role: input.role || 'USER',
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);

      // Publish subscription event
      if (global.pubsub) {
        global.pubsub.publish('USER_CREATED', { userCreated: newUser });
      }

      return newUser;
    },

    createPost: (_: any, { input }: { input: any }) => {
      const newPost = {
        id: String(posts.length + 1),
        title: input.title,
        content: input.content,
        authorId: input.authorId,
        publishedAt: null,
        status: 'DRAFT',
      };
      posts.push(newPost);

      // Publish subscription event
      if (global.pubsub) {
        global.pubsub.publish('POST_CREATED', { postCreated: newPost });
      }

      return newPost;
    },

    createComment: (_: any, { input }: { input: any }) => {
      const newComment = {
        id: String(comments.length + 1),
        content: input.content,
        postId: input.postId,
        authorId: input.authorId,
        createdAt: new Date().toISOString(),
      };
      comments.push(newComment);

      // Publish subscription event
      if (global.pubsub) {
        global.pubsub.publish('COMMENT_ADDED', { commentAdded: newComment });
      }

      return newComment;
    },

    updateUser: (_: any, { id, ...updates }: { id: string; name?: string; email?: string; role?: string }) => {
      const user = users.find(u => u.id === id);
      if (!user) throw new Error('User not found');

      Object.assign(user, updates);
      return user;
    },

    deleteUser: (_: any, { id }: { id: string }) => {
      const index = users.findIndex(u => u.id === id);
      if (index === -1) return false;

      users.splice(index, 1);
      return true;
    },

    publishPost: (_: any, { id }: { id: string }) => {
      const post = posts.find(p => p.id === id);
      if (!post) throw new Error('Post not found');

      post.status = 'PUBLISHED';
      post.publishedAt = new Date().toISOString();
      return post;
    },

    deletePost: (_: any, { id }: { id: string }) => {
      const index = posts.findIndex(p => p.id === id);
      if (index === -1) return false;

      posts.splice(index, 1);
      return true;
    },
  },

  // Subscription resolvers
  Subscription: {
    userCreated: {
      subscribe: (_: any, __: any, { pubsub }: any) => pubsub.asyncIterator('USER_CREATED'),
    },

    postCreated: {
      subscribe: (_: any, __: any, { pubsub }: any) => pubsub.asyncIterator('POST_CREATED'),
    },

    commentAdded: {
      subscribe: (_: any, __: any, { pubsub }: any) => pubsub.asyncIterator('COMMENT_ADDED'),
    },
  },

  // Relationship resolvers with DataLoader
  User: {
    posts: createLoaderResolver('userPosts', (user: any) => user.id),
    createdAt: (user: any) => user.createdAt || new Date().toISOString(),
  },

  Post: {
    author: createLoaderResolver('user', (post: any) => post.authorId),
    comments: createLoaderResolver('postComments', (post: any) => post.id),
    status: (post: any) => post.status || 'DRAFT',
  },

  Comment: {
    author: createLoaderResolver('user', (comment: any) => comment.authorId),
    post: createLoaderResolver('post', (comment: any) => comment.postId),
  },
};

// Create the app
const app = createApp();

// Global middleware
app.use(async (ctx: Context, next) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  return next();
});

// Add GraphQL endpoint
app.use(graphqlPlugin({
  schema: typeDefs,
  resolvers,
  endpoint: '/graphql',
  subscriptionsEndpoint: '/graphql/subscriptions',
  playground: process.env.NODE_ENV !== 'production',
  introspection: true,
  dataLoaders: {
    user: userLoader,
    post: postLoader,
    comment: commentLoader,
    userPosts: userPostsLoader,
    postComments: postCommentsLoader,
  },
  context: (ctx: Context) => ({
    userId: ctx.req.headers.authorization?.replace('Bearer ', ''),
    requestId: Math.random().toString(36).substring(2, 15),
  }),
  formatError: (error) => ({
    message: error.message,
    locations: error.locations,
    path: error.path,
    extensions: {
      code: error.extensions?.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    },
  }),
}));

// REST API fallback for comparison
app.get('/api/users', (ctx: Context) => {
  return ctx.json({ users });
});

app.get('/api/posts', (ctx: Context) => {
  return ctx.json({ posts });
});

// Health check
app.get('/health', (ctx: Context) => {
  return ctx.json({
    status: 'healthy',
    service: 'OpenSpeed GraphQL API',
    version: '1.0.0',
    endpoints: {
      graphql: '/graphql',
      playground: '/graphql (GET)',
      rest: '/api/*',
      health: '/health',
    },
    features: [
      'Schema-first development',
      'DataLoader integration',
      'Real-time subscriptions',
      'Type generation',
      'GraphQL Playground',
    ],
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get('/', (ctx: Context) => {
  return ctx.json({
    name: 'OpenSpeed GraphQL API Example',
    description: 'Comprehensive GraphQL integration with DataLoader, subscriptions, and type generation',
    endpoints: {
      graphql: {
        url: '/graphql',
        method: 'POST',
        description: 'GraphQL endpoint for queries and mutations',
      },
      playground: {
        url: '/graphql',
        method: 'GET',
        description: 'Interactive GraphQL Playground',
      },
      rest: {
        url: '/api/*',
        description: 'REST API fallback for comparison',
      },
    },
    examples: {
      query: `
        query GetUsers {
          users(limit: 5) {
            id
            name
            email
            posts {
              id
              title
            }
          }
        }
      `,
      mutation: `
        mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) {
            id
            name
            email
          }
        }
      `,
      subscription: `
        subscription OnUserCreated {
          userCreated {
            id
            name
            email
          }
        }
      `,
    },
  });
});

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🚀 OpenSpeed GraphQL API Example                            ║
║   GraphQL: http://localhost:${port}/graphql                      ║
║   Playground: http://localhost:${port}/graphql (GET)             ║
║   REST API: http://localhost:${port}/api/*                       ║
║   Health: http://localhost:${port}/health                         ║
╚════════════════════════════════════════════════════════════════╝

Features:
✅ Schema-first development with auto-generated resolvers
✅ DataLoader integration for efficient batching and caching
✅ Real-time subscriptions with WebSocket support
✅ Type generation from GraphQL schema
✅ Interactive GraphQL Playground
✅ Custom scalars and enums
✅ Advanced error formatting
✅ Relationship resolvers with batching

Try these queries in the GraphQL Playground:

1. Get all users with their posts:
   query { users { id name posts { title } } }

2. Create a new user:
   mutation($input: CreateUserInput!) {
     createUser(input: $input) { id name email }
   }

3. Subscribe to new users:
   subscription { userCreated { id name } }

4. Get statistics:
   query { stats { totalUsers totalPosts } }
`);

await app.listen(port);
