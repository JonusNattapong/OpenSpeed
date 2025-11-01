import { Hono } from 'hono';

const app = new Hono();

// In-memory data store (for benchmark purposes)
let users: any[] = [];
let posts: any[] = [];
let comments: any[] = [];
let userIdCounter = 1;
let postIdCounter = 1;
let commentIdCounter = 1;

// Middleware: Authentication
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const user = users.find(u => u.token === token);

  if (!user) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('user', user);
  await next();
};

// Middleware: CORS
const corsMiddleware = async (c: any, next: any) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }

  await next();
};

// Middleware: Request logging
const loggingMiddleware = async (c: any, next: any) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);

  await next();

  const duration = Date.now() - start;
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path} - ${c.res.status} - ${duration}ms`);
};

// Apply global middleware
app.use('*', corsMiddleware);
app.use('*', loggingMiddleware);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    framework: 'hono',
    scenario: 'real-world',
    version: '1.0',
    timestamp: new Date().toISOString()
  });
});

// User registration
app.post('/api/users', async (c) => {
  const { email, username, password } = await c.req.json();

  // Check if user exists
  if (users.find(u => u.email === email || u.username === username)) {
    return c.json({ error: 'User already exists' }, 400);
  }

  const user = {
    id: userIdCounter++,
    email,
    username,
    password, // In real app, this would be hashed
    token: Math.random().toString(36).substring(2),
    bio: '',
    image: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  users.push(user);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token: user.token
    }
  });
});

// User login
app.post('/api/users/login', async (c) => {
  const { email, password } = await c.req.json();

  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token: user.token
    }
  });
});

// Get current user
app.get('/api/user', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token: user.token
    }
  });
});

// Update user
app.put('/api/user', authMiddleware, async (c) => {
  const user = c.get('user');
  const updates = await c.req.json();

  Object.assign(user, updates, { updatedAt: new Date().toISOString() });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token: user.token
    }
  });
});

// List articles
app.get('/api/articles', (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');
  const tag = c.req.query('tag');
  const author = c.req.query('author');
  const favorited = c.req.query('favorited');

  let filteredPosts = [...posts];

  if (tag) {
    filteredPosts = filteredPosts.filter(p => p.tagList.includes(tag));
  }

  if (author) {
    filteredPosts = filteredPosts.filter(p => p.author.username === author);
  }

  if (favorited) {
    filteredPosts = filteredPosts.filter(p => p.favoritedBy.includes(favorited));
  }

  const paginatedPosts = filteredPosts.slice(offset, offset + limit);

  return c.json({
    articles: paginatedPosts.map(p => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      body: p.body,
      tagList: p.tagList,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      favorited: false, // Would check current user
      favoritesCount: p.favoritedBy.length,
      author: p.author
    })),
    articlesCount: filteredPosts.length
  });
});

// Get article
app.get('/api/articles/:slug', (c) => {
  const slug = c.req.param('slug');
  const post = posts.find(p => p.slug === slug);

  if (!post) {
    return c.json({ error: 'Article not found' }, 404);
  }

  return c.json({
    article: {
      slug: post.slug,
      title: post.title,
      description: post.description,
      body: post.body,
      tagList: post.tagList,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      favorited: false,
      favoritesCount: post.favoritedBy.length,
      author: post.author
    }
  });
});

// Create article
app.post('/api/articles', authMiddleware, async (c) => {
  const user = c.get('user');
  const { title, description, body, tagList } = await c.req.json();

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const post = {
    id: postIdCounter++,
    slug,
    title,
    description,
    body,
    tagList: tagList || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: {
      username: user.username,
      bio: user.bio,
      image: user.image,
      following: false
    },
    favoritedBy: []
  };

  posts.push(post);

  return c.json({
    article: {
      slug: post.slug,
      title: post.title,
      description: post.description,
      body: post.body,
      tagList: post.tagList,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      favorited: false,
      favoritesCount: 0,
      author: post.author
    }
  });
});

// Update article
app.put('/api/articles/:slug', authMiddleware, async (c) => {
  const user = c.get('user');
  const slug = c.req.param('slug');
  const post = posts.find(p => p.slug === slug);

  if (!post) {
    return c.json({ error: 'Article not found' }, 404);
  }

  if (post.author.username !== user.username) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const updates = await c.req.json();
  Object.assign(post, updates, { updatedAt: new Date().toISOString() });

  return c.json({
    article: {
      slug: post.slug,
      title: post.title,
      description: post.description,
      body: post.body,
      tagList: post.tagList,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      favorited: false,
      favoritesCount: post.favoritedBy.length,
      author: post.author
    }
  });
});

// Delete article
app.delete('/api/articles/:slug', authMiddleware, (c) => {
  const user = c.get('user');
  const slug = c.req.param('slug');
  const postIndex = posts.findIndex(p => p.slug === slug);

  if (postIndex === -1) {
    return c.json({ error: 'Article not found' }, 404);
  }

  const post = posts[postIndex];
  if (post.author.username !== user.username) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  posts.splice(postIndex, 1);
  return c.json({ message: 'Article deleted' });
});

// Add comment
app.post('/api/articles/:slug/comments', authMiddleware, async (c) => {
  const user = c.get('user');
  const slug = c.req.param('slug');
  const post = posts.find(p => p.slug === slug);

  if (!post) {
    return c.json({ error: 'Article not found' }, 404);
  }

  const { body } = await c.req.json();

  const comment = {
    id: commentIdCounter++,
    body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: {
      username: user.username,
      bio: user.bio,
      image: user.image,
      following: false
    }
  };

  post.comments = post.comments || [];
  post.comments.push(comment);

  return c.json({ comment });
});

// Get comments
app.get('/api/articles/:slug/comments', (c) => {
  const slug = c.req.param('slug');
  const post = posts.find(p => p.slug === slug);

  if (!post) {
    return c.json({ error: 'Article not found' }, 404);
  }

  return c.json({
    comments: post.comments || []
  });
});

// Get profile
app.get('/api/profiles/:username', (c) => {
  const username = c.req.param('username');
  const user = users.find(u => u.username === username);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    profile: {
      username: user.username,
      bio: user.bio,
      image: user.image,
      following: false // Would check if current user follows this user
    }
  });
});

// Follow user
app.post('/api/profiles/:username/follow', authMiddleware, (c) => {
  const currentUser = c.get('user');
  const username = c.req.param('username');
  const user = users.find(u => u.username === username);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // In a real app, this would update following relationships
  return c.json({
    profile: {
      username: user.username,
      bio: user.bio,
      image: user.image,
      following: true
    }
  });
});

// Get tags
app.get('/api/tags', (c) => {
  const allTags = new Set<string>();
  posts.forEach(post => {
    post.tagList.forEach((tag: string) => allTags.add(tag));
  });

  return c.json({
    tags: Array.from(allTags)
  });
});

const port = process.argv[2] || '3104';
export default {
  port,
  fetch: app.fetch,
};