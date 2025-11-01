import { Elysia } from 'elysia';

// In-memory data store (for benchmark purposes)
let users: any[] = [];
let posts: any[] = [];
let comments: any[] = [];
let userIdCounter = 1;
let postIdCounter = 1;
let commentIdCounter = 1;

// Plugin: Authentication
const authPlugin = () => (app: any) =>
  app.derive(({ headers, set }) => {
    const authHeader = headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);
    const user = users.find(u => u.token === token);

    if (!user) {
      set.status = 401;
      return { error: 'Invalid token' };
    }

    return { user };
  });

// Plugin: CORS
const corsPlugin = () => (app: any) =>
  app.onBeforeHandle(({ set }) => {
    set.headers['Access-Control-Allow-Origin'] = '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  })
  .onRequest(({ request, set }) => {
    if (request.method === 'OPTIONS') {
      set.status = 200;
      return '';
    }
  });

// Plugin: Request logging
const loggingPlugin = () => (app: any) =>
  app.onBeforeHandle(({ request, store }) => {
    (store as any).startTime = Date.now();
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  })
  .onAfterHandle(({ request, store, set }) => {
    const startTime = (store as any).startTime || Date.now();
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url} - ${set.status} - ${duration}ms`);
  });

const app = new Elysia();

// Apply global plugins
app.use(corsPlugin());
app.use(loggingPlugin());

// Health check
app.get('/health', () => {
  return {
    status: 'ok',
    framework: 'elysia',
    scenario: 'real-world',
    version: '1.0',
    timestamp: new Date().toISOString()
  };
});

// User registration
app.post('/api/users', async ({ body }) => {
  const { email, username, password } = body;

  // Check if user exists
  if (users.find(u => u.email === email || u.username === username)) {
    return { error: 'User already exists' };
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

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token: user.token
    }
  };
});

// User login
app.post('/api/users/login', async ({ body }) => {
  const { email, password } = body;

  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    return { error: 'Invalid credentials' };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token: user.token
    }
  };
});

// Get current user
app.use(authPlugin())
  .get('/api/user', ({ user }) => {
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        bio: user.bio,
        image: user.image,
        token: user.token
      }
    };
  });

// Update user
app.use(authPlugin())
  .put('/api/user', async ({ user, body }) => {
    const updates = body;
    Object.assign(user, updates, { updatedAt: new Date().toISOString() });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        bio: user.bio,
        image: user.image,
        token: user.token
      }
    };
  });

// List articles
app.get('/api/articles', ({ query }) => {
  const limit = parseInt(query.limit || '20');
  const offset = parseInt(query.offset || '0');
  const tag = query.tag;
  const author = query.author;
  const favorited = query.favorited;

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

  return {
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
  };
});

// Get article
app.get('/api/articles/:slug', ({ params }) => {
  const slug = params.slug;
  const post = posts.find(p => p.slug === slug);

  if (!post) {
    return { error: 'Article not found' };
  }

  return {
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
  };
});

// Create article
app.use(authPlugin())
  .post('/api/articles', async ({ user, body }) => {
    const { title, description, body: articleBody, tagList } = body;

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const post = {
      id: postIdCounter++,
      slug,
      title,
      description,
      body: articleBody,
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

    return {
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
    };
  });

// Update article
app.use(authPlugin())
  .put('/api/articles/:slug', async ({ user, params, body }) => {
    const slug = params.slug;
    const post = posts.find(p => p.slug === slug);

    if (!post) {
      return { error: 'Article not found' };
    }

    if (post.author.username !== user.username) {
      return { error: 'Unauthorized' };
    }

    const updates = body;
    Object.assign(post, updates, { updatedAt: new Date().toISOString() });

    return {
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
    };
  });

// Delete article
app.use(authPlugin())
  .delete('/api/articles/:slug', ({ user, params }) => {
    const slug = params.slug;
    const postIndex = posts.findIndex(p => p.slug === slug);

    if (postIndex === -1) {
      return { error: 'Article not found' };
    }

    const post = posts[postIndex];
    if (post.author.username !== user.username) {
      return { error: 'Unauthorized' };
    }

    posts.splice(postIndex, 1);
    return { message: 'Article deleted' };
  });

// Add comment
app.use(authPlugin())
  .post('/api/articles/:slug/comments', async ({ user, params, body }) => {
    const slug = params.slug;
    const post = posts.find(p => p.slug === slug);

    if (!post) {
      return { error: 'Article not found' };
    }

    const { body: commentBody } = body;

    const comment = {
      id: commentIdCounter++,
      body: commentBody,
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

    return { comment };
  });

// Get comments
app.get('/api/articles/:slug/comments', ({ params }) => {
  const slug = params.slug;
  const post = posts.find(p => p.slug === slug);

  if (!post) {
    return { error: 'Article not found' };
  }

  return {
    comments: post.comments || []
  };
});

// Get profile
app.get('/api/profiles/:username', ({ params }) => {
  const username = params.username;
  const user = users.find(u => u.username === username);

  if (!user) {
    return { error: 'User not found' };
  }

  return {
    profile: {
      username: user.username,
      bio: user.bio,
      image: user.image,
      following: false // Would check if current user follows this user
    }
  };
});

// Follow user
app.use(authPlugin())
  .post('/api/profiles/:username/follow', ({ user, params }) => {
    const username = params.username;
    const targetUser = users.find(u => u.username === username);

    if (!targetUser) {
      return { error: 'User not found' };
    }

    // In a real app, this would update following relationships
    return {
      profile: {
        username: targetUser.username,
        bio: targetUser.bio,
        image: targetUser.image,
        following: true
      }
    };
  });

// Get tags
app.get('/api/tags', () => {
  const allTags = new Set<string>();
  posts.forEach(post => {
    post.tagList.forEach((tag: string) => allTags.add(tag));
  });

  return {
    tags: Array.from(allTags)
  };
});

const port = process.argv[2] || '3204';
export default {
  port,
  fetch: app.fetch,
};