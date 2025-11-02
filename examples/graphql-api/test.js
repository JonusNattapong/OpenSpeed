<file_path>
OpenSpeed\examples\graphql-api\test.js
</file_path>

<edit_description>
Create a test file for the GraphQL API
</edit_description>

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
let serverProcess;

describe('GraphQL API Tests', () => {
  before(async () => {
    // Start the server
    serverProcess = spawn('node', ['index.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test', PORT: '3000' }
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within 10 seconds'));
      }, 10000);

      const checkReady = (data) => {
        output += data.toString();
        if (output.includes('listening on port 3000')) {
          clearTimeout(timeout);
          setTimeout(resolve, 1000); // Wait a bit more for full startup
        }
      };

      serverProcess.stdout.on('data', checkReady);
      serverProcess.stderr.on('data', checkReady);

      serverProcess.on('error', reject);
    });
  });

  after(async () => {
    // Stop the server
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        serverProcess.on('close', resolve);
        setTimeout(resolve, 5000); // Force kill after 5 seconds
      });
    }
  });

  // Helper function to make GraphQL requests
  async function graphqlQuery(query, variables = {}) {
    const response = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    return response.json();
  }

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.status, 'healthy');
      assert.strictEqual(data.service, 'OpenSpeed GraphQL API');
      assert(data.timestamp);
    });
  });

  describe('GraphQL Queries', () => {
    test('should get all users', async () => {
      const query = `
        query GetUsers {
          users {
            id
            name
            email
            role
          }
        }
      `;

      const result = await graphqlQuery(query);

      assert(!result.errors, `GraphQL errors: ${JSON.stringify(result.errors)}`);
      assert(Array.isArray(result.data.users));
      assert(result.data.users.length > 0);

      const user = result.data.users[0];
      assert(user.id);
      assert(user.name);
      assert(user.email);
      assert(['ADMIN', 'MODERATOR', 'USER'].includes(user.role));
    });

    test('should get single user by ID', async () => {
      const query = `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            name
            email
            posts {
              id
              title
            }
          }
        }
      `;

      const result = await graphqlQuery(query, { id: '1' });

      assert(!result.errors);
      assert(result.data.user);
      assert.strictEqual(result.data.user.id, '1');
      assert(result.data.user.name);
      assert(Array.isArray(result.data.user.posts));
    });

    test('should get posts with author information', async () => {
      const query = `
        query GetPosts {
          posts {
            id
            title
            author {
              id
              name
              email
            }
            comments {
              id
              content
              author {
                name
              }
            }
          }
        }
      `;

      const result = await graphqlQuery(query);

      assert(!result.errors);
      assert(Array.isArray(result.data.posts));
      assert(result.data.posts.length > 0);

      const post = result.data.posts[0];
      assert(post.id);
      assert(post.title);
      assert(post.author);
      assert(post.author.id);
      assert(post.author.name);
      assert(Array.isArray(post.comments));
    });

    test('should get statistics', async () => {
      const query = `
        query GetStats {
          stats {
            totalUsers
            totalPosts
            totalComments
            postsPublishedToday
          }
        }
      `;

      const result = await graphqlQuery(query);

      assert(!result.errors);
      assert(result.data.stats);
      assert(typeof result.data.stats.totalUsers === 'number');
      assert(typeof result.data.stats.totalPosts === 'number');
      assert(typeof result.data.stats.totalComments === 'number');
      assert(typeof result.data.stats.postsPublishedToday === 'number');
    });
  });

  describe('GraphQL Mutations', () => {
    test('should create a new user', async () => {
      const mutation = `
        mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) {
            id
            name
            email
            role
          }
        }
      `;

      const variables = {
        input: {
          name: 'Test User',
          email: `test-${Date.now()}@example.com`,
          role: 'USER'
        }
      };

      const result = await graphqlQuery(mutation, variables);

      assert(!result.errors);
      assert(result.data.createUser);
      assert(result.data.createUser.id);
      assert.strictEqual(result.data.createUser.name, variables.input.name);
      assert.strictEqual(result.data.createUser.email, variables.input.email);
      assert.strictEqual(result.data.createUser.role, 'USER');
    });

    test('should create a post', async () => {
      const mutation = `
        mutation CreatePost($input: CreatePostInput!) {
          createPost(input: $input) {
            id
            title
            content
            author {
              id
              name
            }
            status
          }
        }
      `;

      const variables = {
        input: {
          title: 'Test Post',
          content: 'This is a test post content',
          authorId: '1'
        }
      };

      const result = await graphqlQuery(mutation, variables);

      assert(!result.errors);
      assert(result.data.createPost);
      assert(result.data.createPost.id);
      assert.strictEqual(result.data.createPost.title, variables.input.title);
      assert.strictEqual(result.data.createPost.status, 'DRAFT');
      assert(result.data.createPost.author);
    });

    test('should create a comment', async () => {
      const mutation = `
        mutation CreateComment($input: CreateCommentInput!) {
          createComment(input: $input) {
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
      `;

      const variables = {
        input: {
          content: 'This is a test comment',
          postId: '1',
          authorId: '2'
        }
      };

      const result = await graphqlQuery(mutation, variables);

      assert(!result.errors);
      assert(result.data.createComment);
      assert(result.data.createComment.id);
      assert.strictEqual(result.data.createComment.content, variables.input.content);
      assert(result.data.createComment.createdAt);
    });

    test('should publish a post', async () => {
      // First create a draft post
      const createMutation = `
        mutation CreatePost($input: CreatePostInput!) {
          createPost(input: $input) {
            id
          }
        }
      `;

      const createResult = await graphqlQuery(createMutation, {
        input: {
          title: 'Post to Publish',
          content: 'Content to be published',
          authorId: '1'
        }
      });

      const postId = createResult.data.createPost.id;

      // Now publish it
      const publishMutation = `
        mutation PublishPost($id: ID!) {
          publishPost(id: $id) {
            id
            status
            publishedAt
          }
        }
      `;

      const publishResult = await graphqlQuery(publishMutation, { id: postId });

      assert(!publishResult.errors);
      assert(publishResult.data.publishPost);
      assert.strictEqual(publishResult.data.publishPost.status, 'PUBLISHED');
      assert(publishResult.data.publishPost.publishedAt);
    });
  });

  describe('DataLoader Efficiency', () => {
    test('should batch load users efficiently', async () => {
      const query = `
        query GetMultipleUsers {
          user1: user(id: "1") { id name posts { title } }
          user2: user(id: "2") { id name posts { title } }
          user3: user(id: "3") { id name posts { title } }
        }
      `;

      const result = await graphqlQuery(query);

      assert(!result.errors);
      assert(result.data.user1);
      assert(result.data.user2);
      assert(result.data.user3);

      // All users should have posts loaded efficiently via DataLoader
      assert(Array.isArray(result.data.user1.posts));
      assert(Array.isArray(result.data.user2.posts));
      assert(Array.isArray(result.data.user3.posts));
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent user', async () => {
      const query = `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            name
          }
        }
      `;

      const result = await graphqlQuery(query, { id: '999' });

      assert(!result.errors); // GraphQL returns null for missing data, not errors
      assert.strictEqual(result.data.user, null);
    });

    test('should handle invalid GraphQL syntax', async () => {
      const response = await fetch(`${BASE_URL}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'invalid query {' }),
      });

      const result = await response.json();

      assert(result.errors);
      assert(result.errors.length > 0);
      assert(result.errors[0].message);
    });
  });

  describe('REST API Fallback', () => {
    test('should provide REST API for users', async () => {
      const response = await fetch(`${BASE_URL}/api/users`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert(Array.isArray(data.users));
      assert(data.users.length > 0);
    });

    test('should provide REST API for posts', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert(Array.isArray(data.posts));
    });
  });

  describe('GraphQL Playground', () => {
    test('should serve GraphQL Playground', async () => {
      const response = await fetch(`${BASE_URL}/graphql`);
      const html = await response.text();

      assert.strictEqual(response.status, 200);
      assert(html.includes('GraphQL Playground'));
      assert(html.includes('OpenSpeed'));
    });
  });

  describe('Introspection', () => {
    test('should support GraphQL introspection', async () => {
      const query = `
        query IntrospectionQuery {
          __schema {
            types {
              name
              kind
            }
          }
        }
      `;

      const result = await graphqlQuery(query);

      assert(!result.errors);
      assert(result.data.__schema);
      assert(Array.isArray(result.data.__schema.types));

      // Should include our custom types
      const typeNames = result.data.__schema.types.map(t => t.name);
      assert(typeNames.includes('User'));
      assert(typeNames.includes('Post'));
      assert(typeNames.includes('Comment'));
      assert(typeNames.includes('UserRole'));
      assert(typeNames.includes('PostStatus'));
      assert(typeNames.includes('DateTime'));
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  // Simple test runner for environments without node:test
  console.log('Running GraphQL API tests...\n');

  const runTests = async () => {
    try {
      // Basic connectivity test
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        console.log('✅ Server is running');
      } else {
        console.log('❌ Server is not responding');
        process.exit(1);
      }

      // Basic GraphQL test
      const query = `query { users { id name } }`;
      const gqlResponse = await fetch(`${BASE_URL}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (gqlResponse.ok) {
        const result = await gqlResponse.json();
        if (result.data && result.data.users) {
          console.log('✅ GraphQL API is working');
          console.log(`   Found ${result.data.users.length} users`);
        } else {
          console.log('❌ GraphQL query failed');
        }
      } else {
        console.log('❌ GraphQL endpoint not responding');
      }

    } catch (error) {
      console.log('❌ Test failed:', error.message);
      process.exit(1);
    }
  };

  runTests();
}
