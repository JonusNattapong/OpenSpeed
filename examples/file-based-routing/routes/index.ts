import type { Context } from '../../../src/openspeed/context.js';

export async function GET(ctx: Context) {
  return ctx.json({
    message: 'Welcome to OpenSpeed File-Based Routing API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      posts: '/api/posts',
      'user-detail': '/api/users/[id]',
      'post-detail': '/api/posts/[id]',
      'user-posts': '/api/users/[id]/posts',
      'catch-all': '/api/blog/[...slug]',
    },
    timestamp: new Date().toISOString(),
  });
}
