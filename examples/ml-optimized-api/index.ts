import { Openspeed, adaptiveOptimizer, database, logger } from '../../src/openspeed/index.js';
import type { Context } from '../../src/openspeed/context.js';

/**
 * ML-Optimized E-commerce API
 *
 * This example demonstrates a production-ready e-commerce API
 * with full ML optimization capabilities including:
 * - Performance prediction and caching
 * - Intelligent resource allocation
 * - Real-time anomaly detection
 * - Query optimization
 * - Adaptive load balancing
 */

const app = Openspeed();

// Logger for monitoring
app.use(
  logger({
    json: true,
  })
);

// ML Optimizer with comprehensive configuration
app.use(
  adaptiveOptimizer({
    enableBatching: true,
    enableCaching: true,
    enablePrefetching: true,
    enableCompression: true,
    ml: {
      enabled: true,
      trainingInterval: 15,
    },
    performance: {
      targetLatency: 50,
      maxMemory: 1024,
    },
  })
);

// Database connection
app.use(
  database('default', {
    type: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      database: 'ecommerce',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
  })
);

// ==================== Routes ====================

/**
 * Health check endpoint
 * Low priority, frequently accessed
 */
app.get('/health', async (ctx: Context) => {
  return ctx.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mlOptimized: true,
  });
});

/**
 * Product listing
 * High traffic, good candidate for predictive caching
 */
app.get('/api/products', async (ctx: Context) => {
  const page = parseInt(ctx.getQuery('page') || '1');
  const limit = parseInt(ctx.getQuery('limit') || '20');
  const category = ctx.getQuery('category');

  // ML will learn this pattern and apply caching
  const products = await (ctx as any).db.query(
    `
    SELECT * FROM products
    WHERE active = true
    ${category ? 'AND category = $1' : ''}
    ORDER BY created_at DESC
    LIMIT $${category ? 2 : 1} OFFSET $${category ? 3 : 2}
  `,
    category ? [category, limit, (page - 1) * limit] : [limit, (page - 1) * limit]
  );

  return ctx.json({
    products,
    page,
    limit,
    mlHeaders: {
      confidence: ctx.res.headers?.['x-ml-prediction-confidence'],
      optimization: ctx.res.headers?.['x-optimization-applied'],
    },
  });
});

/**
 * Product search
 * Variable performance, benefits from query optimization
 */
app.get('/api/search', async (ctx: Context) => {
  const query = ctx.getQuery('q');

  if (!query) {
    return ctx.json({ error: 'Search query required' }, 400);
  }

  // Track query execution for ML learning
  ctx.queryExecutions = [];
  const start = Date.now();

  const results = await (ctx as any).db.query(
    `
    SELECT * FROM products
    WHERE
      to_tsvector('english', name || ' ' || description) @@ plainto_tsquery('english', $1)
      OR name ILIKE $2
    ORDER BY popularity DESC
    LIMIT 50
  `,
    [query, `%${query}%`]
  );

  ctx.queryExecutions.push({
    query: 'SEARCH products',
    duration: Date.now() - start,
  });

  return ctx.json({
    results,
    count: results.length,
    query,
  });
});

/**
 * Product details
 * Frequently accessed, high cache potential
 */
app.get('/api/products/:id', async (ctx: Context) => {
  const id = ctx.getParam('id');

  const product = (await (ctx as any).db.query('SELECT * FROM products WHERE id = $1', [id]))[0];

  if (!product) {
    return ctx.json({ error: 'Product not found' }, 404);
  }

  return ctx.json(product);
});

/**
 * Shopping cart operations
 * Medium priority, session-based
 */
app.get('/api/cart', async (ctx: Context) => {
  const userId = ctx.getUser()?.id;

  if (!userId) {
    return ctx.json({ error: 'Unauthorized' }, 401);
  }

  const cart = await (ctx as any).db.query('SELECT * FROM cart_items WHERE user_id = $1', [userId]);

  return ctx.json({ items: cart });
});

app.post('/api/cart', async (ctx: Context) => {
  const userId = ctx.getUser()?.id;

  if (!userId) {
    return ctx.json({ error: 'Unauthorized' }, 401);
  }

  const { productId, quantity } = ctx.getBody();

  const item = (
    await (ctx as any).db.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + $3
     RETURNING *`,
      [userId, productId, quantity]
    )
  )[0];

  return ctx.json(item);
});

/**
 * Checkout process
 * CRITICAL: High priority, requires optimal resources
 */
app.post('/api/checkout', async (ctx: Context) => {
  // Mark as high priority for resource allocation
  ctx.req.headers['x-priority'] = 'high';

  const userId = ctx.getUser()?.id;

  if (!userId) {
    return ctx.json({ error: 'Unauthorized' }, 401);
  }

  const { paymentMethod, shippingAddress } = ctx.getBody();

  try {
    // Start transaction
    await (ctx as any).db.query('BEGIN');

    // Get cart items
    const cartItems = await (ctx as any).db.query('SELECT * FROM cart_items WHERE user_id = $1', [
      userId,
    ]);

    if (cartItems.length === 0) {
      await (ctx as any).db.query('ROLLBACK');
      return ctx.json({ error: 'Cart is empty' }, 400);
    }

    // Calculate total
    const total = cartItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    // Create order
    const order = (
      await (ctx as any).db.query(
        `INSERT INTO orders (user_id, total, payment_method, shipping_address, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
        [userId, total, paymentMethod, JSON.stringify(shippingAddress)]
      )
    )[0];

    // Create order items
    for (const item of cartItems) {
      await (ctx as any).db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.price]
      );
    }

    // Clear cart
    await (ctx as any).db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    // Process payment (simulated)
    const paymentSuccess = await processPayment(order.id, total, paymentMethod);

    if (paymentSuccess) {
      await (ctx as any).db.query('UPDATE orders SET status = $1 WHERE id = $2', [
        'completed',
        order.id,
      ]);
      await (ctx as any).db.query('COMMIT');

      return ctx.json({
        success: true,
        order: { ...order, status: 'completed' },
        message: 'Order placed successfully',
      });
    } else {
      await (ctx as any).db.query('ROLLBACK');
      return ctx.json(
        {
          success: false,
          error: 'Payment failed',
        },
        400
      );
    }
  } catch (error) {
    await (ctx as any).db.query('ROLLBACK');
    throw error;
  }
});

/**
 * Order history
 * Medium priority, user-specific
 */
app.get('/api/orders', async (ctx: Context) => {
  const userId = ctx.getUser()?.id;

  if (!userId) {
    return ctx.json({ error: 'Unauthorized' }, 401);
  }

  const orders = await (ctx as any).db.query(
    `SELECT o.*,
      json_agg(json_build_object(
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'price', oi.price
      )) as items
     FROM orders o
     LEFT JOIN order_items oi ON o.id = oi.order_id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [userId]
  );

  return ctx.json({ orders });
});

/**
 * Analytics endpoint
 * Low priority, batch processing preferred
 */
app.get('/api/analytics', async (ctx: Context) => {
  ctx.req.headers['x-priority'] = 'low';

  const stats = await (ctx as any).db.query(`
    SELECT
      COUNT(*) as total_orders,
      SUM(total) as total_revenue,
      AVG(total) as avg_order_value,
      COUNT(DISTINCT user_id) as unique_customers
    FROM orders
    WHERE created_at > NOW() - INTERVAL '30 days'
  `);

  const topProducts = await (ctx as any).db.query(`
    SELECT
      p.id,
      p.name,
      COUNT(oi.id) as order_count,
      SUM(oi.quantity) as units_sold
    FROM products p
    JOIN order_items oi ON p.id = oi.product_id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at > NOW() - INTERVAL '30 days'
    GROUP BY p.id, p.name
    ORDER BY units_sold DESC
    LIMIT 10
  `);

  return ctx.json({
    stats: stats[0],
    topProducts,
    period: '30 days',
  });
});

/**
 * ML Metrics endpoint
 * For monitoring ML optimizer performance
 */
app.get('/api/ml-metrics', async (ctx: Context) => {
  return ctx.json({
    message: 'ML metrics available in response headers',
    headers: {
      predictionConfidence: ctx.res.headers?.['x-ml-prediction-confidence'],
      optimizationApplied: ctx.res.headers?.['x-optimization-applied'],
      anomalyScore: ctx.res.headers?.['x-anomaly-score'],
    },
    tips: [
      'Check x-ml-prediction-confidence header for prediction accuracy',
      'x-optimization-applied shows which ML optimization was used',
      'x-anomaly-score indicates if request behavior is anomalous',
    ],
  });
});

/**
 * Stress test endpoint
 * For testing ML optimizer under load
 */
app.get('/api/stress-test', async (ctx: Context) => {
  const complexity = parseInt(ctx.getQuery('complexity') || '100');

  // Simulate varying workload
  const start = Date.now();
  let result = 0;

  for (let i = 0; i < complexity * 1000; i++) {
    result += Math.sqrt(i);
  }

  const duration = Date.now() - start;

  return ctx.json({
    complexity,
    duration,
    result: Math.floor(result),
    mlOptimization: {
      confidence: ctx.res.headers?.['x-ml-prediction-confidence'],
      applied: ctx.res.headers?.['x-optimization-applied'],
      anomaly: ctx.res.headers?.['x-anomaly-score'],
    },
  });
});

// ==================== Helper Functions ====================

async function processPayment(orderId: string, amount: number, method: string): Promise<boolean> {
  // Simulate payment processing
  return new Promise((resolve) => {
    setTimeout(() => {
      // 95% success rate
      resolve(Math.random() > 0.05);
    }, 100);
  });
}

// ==================== Start Server ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
🚀 ML-Optimized E-commerce API Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 Server: http://localhost:${PORT}
🤖 ML Features Enabled:
   ✓ Performance Prediction
   ✓ Resource Allocation
   ✓ Anomaly Detection
   ✓ Query Optimization
   ✓ Load Balancing
   ✓ Auto-scaling

📊 Endpoints:
   GET  /health              - Health check
   GET  /api/products        - List products
   GET  /api/products/:id    - Get product
   GET  /api/search?q=...    - Search products
   GET  /api/cart            - Get cart
   POST /api/cart            - Add to cart
   POST /api/checkout        - Checkout (HIGH PRIORITY)
   GET  /api/orders          - Order history
   GET  /api/analytics       - Analytics (LOW PRIORITY)
   GET  /api/ml-metrics      - ML performance metrics
   GET  /api/stress-test     - Stress testing

🔍 ML Headers to watch:
   • x-ml-prediction-confidence
   • x-optimization-applied
   • x-anomaly-score

⚙️  Configuration:
   • Training Interval: 15 minutes
   • Prediction Threshold: 75%
   • Target Latency: 50ms
   • Max Memory: 1024MB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

export default app;
