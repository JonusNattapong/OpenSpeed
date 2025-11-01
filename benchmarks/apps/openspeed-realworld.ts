OpenSpeed\benchmarks\apps\openspeed-realworld.ts
import { Openspeed, cors, logger, json, errorHandler, auth } from '../../src/openspeed/index.js';
import type { Context } from '../../src/openspeed/context.js';

// Extend Context for benchmark properties
interface BenchmarkContext extends Context {
  user?: any;
}

// In-memory data store
let users: any[] = [];
let posts: any[] = [];
let comments: any[] = [];
let userIdCounter = 1;
let postIdCounter = 1;
let commentIdCounter = 1;

const app = Openspeed();

// Apply global middleware
app.use(cors());
app.use(logger());
app.use(json());
app.use(errorHandler());

// Auth middleware
app.use('/api/user', auth({ secret: 'benchmark-secret' }));
app.use('/api/articles', auth({ secret: 'benchmark-secret' }));

// Health check
app.get('/health', (ctx: BenchmarkContext) => {
  return ctx.json({
    status: 'ok',
    framework: 'openspeed',
    scenario: 'real-world',
    version: '1.0',
    timestamp: new Date().toISOString(),
  });
});

// User registration
app.post('/api/users', async (ctx: BenchmarkContext) => {
  const { email, username, password } = ctx.getBody();

  if (users.find((u) => u.email === email || u.username === username)) {
    return ctx.json({ error: 'User already exists' }, 400);
  }

  const user = {
    id: userIdCounter++,
    email,
    username,
    password,
    token: Math.random().toString(36).substring(2),
    bio: '',
    image: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(user);

  return ctx.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token: user.token,
    },
  });
});

// User login
app.post('/api/users/login', async (ctx: BenchmarkContext) => {
  const { email, password } = ctx.getBody();

  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return ctx.json({ error: 'Invalid credentials' }, 401);
  }

  return ctx.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token: user.token,
    },
  });
});

// Get current user
app.get('/api/user', (ctx: BenchmarkContext) => {
  return ctx.json({
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      username: ctx.user.username,
      bio: ctx.user.bio,
      image: ctx.user.image,
      token: ctx.user.token,
    },
  });
});

// Update user
app.put('/api/user', async (ctx: BenchmarkContext) => {
  const updates = ctx.getBody();
  Object.assign(ctx.user, updates, { updatedAt: new Date().toISOString() });

  return ctx.json({
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      username: ctx.user.username,
      bio: ctx.user.bio,
      image: ctx.user.image,
      token: ctx.user.token,
    },
  });
});

// List articles
app.get('/api/articles', (ctx: BenchmarkContext) => {
  const limit = parseInt(ctx.getQuery('limit') || '20');
  const offset = parseInt(ctx.getQuery('offset') || '0');
  const tag = ctx.getQuery('tag');
  const author = ctx.getQuery('author');

  let filteredPosts = [...posts];

  if (tag) {
    filteredPosts = filteredPosts.filter((p) => p.tagList.includes(tag));
  }

  if (author) {
    filteredPosts = filteredPosts.filter((p) => p.author.username === author);
  }

  const paginatedPosts = filteredPosts.slice(offset, offset + limit);

  return ctx.json({
    articles: paginatedPosts.map((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      body: p.body,
      tagList: p.tagList,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      favorited: false,
      favoritesCount: p.favoritedBy.length,
      author: p.author,
    })),
    articlesCount: filteredPosts.length,
  });
});

// Get article
app.get('/api/articles/:slug', (ctx: BenchmarkContext) => {
  const slug = ctx.getParam('slug');
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return ctx.json({ error: 'Article not found' }, 404);
  }

  return ctx.json({
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
      author: post.author,
    },
  });
});

// Create article
app.post('/api/articles', async (ctx: BenchmarkContext) => {
  const { title, description, body, tagList } = ctx.getBody();

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
      username: ctx.user.username,
      bio: ctx.user.bio,
      image: ctx.user.image,
      following: false,
    },
    favoritedBy: [],
  };

  posts.push(post);

  return ctx.json({
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
      author: post.author,
    },
  });
});

// Update article
app.put('/api/articles/:slug', async (ctx: BenchmarkContext) => {
  const slug = ctx.getParam('slug');
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return ctx.json({ error: 'Article not found' }, 404);
  }

  if (post.author.username !== ctx.user.username) {
    return ctx.json({ error: 'Unauthorized' }, 403);
  }

  const updates = ctx.getBody();
  Object.assign(post, updates, { updatedAt: new Date().toISOString() });

  return ctx.json({
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
      author: post.author,
    },
  });
});

// Delete article
app.delete('/api/articles/:slug', (ctx: BenchmarkContext) => {
  const slug = ctx.getParam('slug');
  const postIndex = posts.findIndex((p) => p.slug === slug);

  if (postIndex === -1) {
    return ctx.json({ error: 'Article not found' }, 404);
  }

  const post = posts[postIndex];
  if (post.author.username !== ctx.user.username) {
    return ctx.json({ error: 'Unauthorized' }, 403);
  }

  posts.splice(postIndex, 1);
  return ctx.json({ message: 'Article deleted' });
});

// Add comment
app.post('/api/articles/:slug/comments', async (ctx: BenchmarkContext) => {
  const slug = ctx.getParam('slug');
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return ctx.json({ error: 'Article not found' }, 404);
  }

  const { body } = ctx.getBody();

  const comment = {
    id: commentIdCounter++,
    body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: {
      username: ctx.user.username,
      bio: ctx.user.bio,
      image: ctx.user.image,
      following: false,
    },
  };

  post.comments = post.comments || [];
  post.comments.push(comment);

  return ctx.json({ comment });
});

// Get comments
app.get('/api/articles/:slug/comments', (ctx: BenchmarkContext) => {
  const slug = ctx.getParam('slug');
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return ctx.json({ error: 'Article not found' }, 404);
  }

  return ctx.json({
    comments: post.comments || [],
  });
});

// Get profile
app.get('/api/profiles/:username', (ctx: BenchmarkContext) => {
  const username = ctx.getParam('username');
  const user = users.find((u) => u.username === username);

  if (!user) {
    return ctx.json({ error: 'User not found' }, 404);
  }

  return ctx.json({
    profile: {
      username: user.username,
      bio: user.bio,
      image: user.image,
      following: false,
    },
  });
});

// Get tags
app.get('/api/tags', (ctx: BenchmarkContext) => {
  const allTags = new Set<string>();
  posts.forEach((post) => {
    post.tagList.forEach((tag: string) => allTags.add(tag));
  });

  return ctx.json({
    tags: Array.from(allTags),
  });
});

const port = process.argv[2] || 3004;
app.listen(port, () => {
  console.log(`OpenSpeed Real-World Benchmark listening on port ${port}`);
});
