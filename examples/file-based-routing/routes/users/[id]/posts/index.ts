import type { Context } from '../../../../../../src/openspeed/context.js';

// Mock posts data
const posts = [
  {
    id: 1,
    userId: 1,
    title: 'Getting Started with OpenSpeed',
    content: 'OpenSpeed is a high-performance web framework...',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    userId: 1,
    title: 'File-Based Routing Guide',
    content: 'Learn how to use file-based routing in OpenSpeed...',
    createdAt: '2024-01-20T14:30:00Z',
  },
  {
    id: 3,
    userId: 2,
    title: 'TypeScript Best Practices',
    content: 'Tips for writing better TypeScript code...',
    createdAt: '2024-01-18T09:15:00Z',
  },
  {
    id: 4,
    userId: 3,
    title: 'API Design Patterns',
    content: 'Common patterns for designing REST APIs...',
    createdAt: '2024-01-22T16:45:00Z',
  },
  {
    id: 5,
    userId: 1,
    title: 'Performance Optimization',
    content: 'How to optimize your OpenSpeed applications...',
    createdAt: '2024-01-25T11:20:00Z',
  },
];

export async function GET(ctx: Context) {
  const { id } = ctx.params;

  if (!id) {
    return ctx.json({ error: 'User ID is required' }, 400);
  }

  const userId = parseInt(id);
  if (isNaN(userId)) {
    return ctx.json({ error: 'Invalid user ID format' }, 400);
  }

  const userPosts = posts.filter((post) => post.userId === userId);

  return ctx.json({
    posts: userPosts,
    userId,
    total: userPosts.length,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(ctx: Context) {
  const { id } = ctx.params;

  if (!id) {
    return ctx.json({ error: 'User ID is required' }, 400);
  }

  const userId = parseInt(id);
  if (isNaN(userId)) {
    return ctx.json({ error: 'Invalid user ID format' }, 400);
  }

  try {
    const body = ctx.getBody();

    if (!body.title || !body.content) {
      return ctx.json({ error: 'Title and content are required' }, 400);
    }

    const newPost = {
      id: Math.max(...posts.map((p) => p.id)) + 1,
      userId,
      title: body.title,
      content: body.content,
      createdAt: new Date().toISOString(),
    };

    posts.push(newPost);

    return ctx.json(newPost, 201);
  } catch (error) {
    return ctx.json({ error: 'Invalid JSON body' }, 400);
  }
}
