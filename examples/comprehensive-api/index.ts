import { createApp } from 'openspeed';
import { cors } from 'openspeed/plugins/cors';
import { security, securityPresets } from 'openspeed/plugins/security';
import { database } from 'openspeed/plugins/database';

// Create the main app
const app = createApp();

// Security middleware
app.use(security(securityPresets.api));

// CORS middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Database middleware
app.use(database({
  type: 'mongodb',
  connection: process.env.DATABASE_URL || 'mongodb://localhost:27017/openspeed-api',
  encryptionKey: process.env.DB_ENCRYPTION_KEY
}));

// Request logging middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`${ctx.req.method} ${ctx.req.url} - ${new Date().toISOString()}`);

  await next();

  const duration = Date.now() - start;
  console.log(`${ctx.req.method} ${ctx.req.url} - ${ctx.res.status} - ${duration}ms`);
});

// Health check endpoint
app.get('/health', (ctx) => {
  return ctx.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// API versioning
const api = createApp();

// Users API
api.get('/users', async (ctx) => {
  try {
    const { db } = ctx;
    const users = await db.collection('users').find({}).toArray();

    return ctx.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    return ctx.json({
      success: false,
      error: 'Failed to fetch users'
    }, 500);
  }
});

api.get('/users/:id', async (ctx) => {
  try {
    const { db } = ctx;
    const userId = ctx.params.id;

    const user = await db.collection('users').findOne({ _id: userId });

    if (!user) {
      return ctx.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    return ctx.json({
      success: true,
      data: user
    });
  } catch (error) {
    return ctx.json({
      success: false,
      error: 'Failed to fetch user'
    }, 500);
  }
});

api.post('/users', async (ctx) => {
  try {
    const { db } = ctx;
    const userData = await ctx.req.json();

    // Basic validation
    if (!userData.name || !userData.email) {
      return ctx.json({
        success: false,
        error: 'Name and email are required'
      }, 400);
    }

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email: userData.email });
    if (existingUser) {
      return ctx.json({
        success: false,
        error: 'User with this email already exists'
      }, 409);
    }

    const newUser = {
      ...userData,
      _id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('users').insertOne(newUser);

    return ctx.json({
      success: true,
      data: newUser
    }, 201);
  } catch (error) {
    return ctx.json({
      success: false,
      error: 'Failed to create user'
    }, 500);
  }
});

api.put('/users/:id', async (ctx) => {
  try {
    const { db } = ctx;
    const userId = ctx.params.id;
    const updateData = await ctx.req.json();

    const result = await db.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return ctx.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    return ctx.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    return ctx.json({
      success: false,
      error: 'Failed to update user'
    }, 500);
  }
});

api.delete('/users/:id', async (ctx) => {
  try {
    const { db } = ctx;
    const userId = ctx.params.id;

    const result = await db.collection('users').deleteOne({ _id: userId });

    if (result.deletedCount === 0) {
      return ctx.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    return ctx.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    return ctx.json({
      success: false,
      error: 'Failed to delete user'
    }, 500);
  }
});

// Products API with pagination and filtering
api.get('/products', async (ctx) => {
  try {
    const { db } = ctx;
    const { page = 1, limit = 10, category, minPrice, maxPrice, search } = ctx.query;

    const query: any = {};

    // Filtering
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await db.collection('products')
      .find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('products').countDocuments(query);

    return ctx.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    return ctx.json({
      success: false,
      error: 'Failed to fetch products'
    }, 500);
  }
});

// File upload endpoint
api.post('/upload', async (ctx) => {
  try {
    const formData = await ctx.req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return ctx.json({
        success: false,
        error: 'No file uploaded'
      }, 400);
    }

    // Basic file validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return ctx.json({
        success: false,
        error: 'Invalid file type. Only JPEG, PNG, and GIF are allowed.'
      }, 400);
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return ctx.json({
        success: false,
        error: 'File too large. Maximum size is 5MB.'
      }, 400);
    }

    // In a real app, you'd save the file to disk or cloud storage
    const fileId = crypto.randomUUID();
    const fileUrl = `/uploads/${fileId}-${file.name}`;

    return ctx.json({
      success: true,
      data: {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: fileUrl
      }
    });
  } catch (error) {
    return ctx.json({
      success: false,
      error: 'Failed to upload file'
    }, 500);
  }
});

// Mount API routes
app.use('/api/v1', api);

// 404 handler
app.use((ctx) => {
  return ctx.json({
    success: false,
    error: 'Endpoint not found'
  }, 404);
});

// Error handler
app.onError((error, ctx) => {
  console.error('Unhandled error:', error);

  return ctx.json({
    success: false,
    error: 'Internal server error'
  }, 500);
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch
};