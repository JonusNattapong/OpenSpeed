# ML-Optimized E-commerce API Example

Production-ready e-commerce API with comprehensive ML optimization.

## Features

- 🤖 **ML-Powered Performance**: Automatic performance prediction and optimization
- ⚡ **Smart Caching**: Predictive caching based on usage patterns
- 🎯 **Resource Allocation**: Intelligent resource distribution based on priority
- 🚨 **Anomaly Detection**: Real-time detection of performance issues
- 💾 **Query Optimization**: Automatic database query optimization
- ⚖️ **Load Balancing**: Adaptive load distribution

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Or with Bun
bun install
```

### Database Setup

```sql
CREATE DATABASE ecommerce;

-- Products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100),
  active BOOLEAN DEFAULT true,
  popularity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX products_search_idx ON products 
  USING GIN (to_tsvector('english', name || ' ' || description));

-- Cart items table
CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  shipping_address JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL
);

-- Sample data
INSERT INTO products (name, description, price, category, popularity) VALUES
  ('Laptop Pro', 'High-performance laptop', 1299.99, 'electronics', 95),
  ('Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 'electronics', 87),
  ('USB-C Cable', 'Fast charging cable', 19.99, 'electronics', 92),
  ('Keyboard Mechanical', 'RGB mechanical keyboard', 149.99, 'electronics', 78),
  ('Monitor 4K', '27-inch 4K monitor', 599.99, 'electronics', 85);
```

### Environment Variables

```bash
# .env
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3000
```

### Run

```bash
# Development
npm run dev

# Or with Bun
bun run index.ts
```

## API Endpoints

### Products

```bash
# List products
GET /api/products?page=1&limit=20&category=electronics

# Search products
GET /api/search?q=laptop

# Get product details
GET /api/products/:id
```

### Shopping Cart

```bash
# Get cart
GET /api/cart

# Add to cart
POST /api/cart
{
  "productId": 1,
  "quantity": 2
}
```

### Checkout

```bash
# Process checkout (HIGH PRIORITY)
POST /api/checkout
{
  "paymentMethod": "credit_card",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Bangkok",
    "country": "Thailand"
  }
}
```

### Orders

```bash
# Get order history
GET /api/orders
```

### Analytics

```bash
# Get analytics (LOW PRIORITY)
GET /api/analytics
```

### ML Monitoring

```bash
# Get ML metrics
GET /api/ml-metrics

# Stress test
GET /api/stress-test?complexity=100
```

## ML Optimization Examples

### Response Headers

Every response includes ML optimization headers:

```
x-ml-prediction-confidence: 85
x-optimization-applied: cache
x-anomaly-score: 0.12
```

### Priority-based Requests

High priority (checkout):
```typescript
ctx.req.headers['x-priority'] = 'high';
// Gets 1.5x more resources
```

Low priority (analytics):
```typescript
ctx.req.headers['x-priority'] = 'low';
// Gets 0.5x resources
```

### Query Tracking

```typescript
ctx.queryExecutions = [];
const result = await db.query('SELECT ...');
ctx.queryExecutions.push({
  query: 'SELECT ...',
  duration: queryTime,
});
// ML learns and optimizes
```

## Performance Testing

### Load Test

```bash
# Install k6
brew install k6  # macOS
choco install k6  # Windows

# Run load test
k6 run loadtest.js
```

### Sample Load Test

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get('http://localhost:3000/api/products');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has ML headers': (r) => r.headers['X-Ml-Prediction-Confidence'] !== undefined,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

## ML Features in Action

### 1. Performance Prediction

The ML optimizer learns request patterns:

```
Request: GET /api/products
Learned pattern: High frequency, stable latency
ML Action: Predictive caching enabled
Result: 80% cache hit rate
```

### 2. Anomaly Detection

Detects unusual behavior:

```
Normal latency: 45ms ± 10ms
Detected spike: 250ms
ML Action: Auto-healing triggered
Result: Request throttling applied
```

### 3. Resource Allocation

Distributes resources intelligently:

```
Checkout (high priority):
  - Memory: 150MB
  - CPU: 15%
  - Workers: 2

Analytics (low priority):
  - Memory: 50MB
  - CPU: 5%
  - Workers: 1
```

### 4. Query Optimization

Suggests index improvements:

```
Slow query detected:
  SELECT * FROM products WHERE category = 'electronics'
  Average time: 150ms
  
ML Suggestion:
  CREATE INDEX idx_category ON products(category)
  
After optimization: 15ms
```

## Monitoring

### Real-time Metrics

```bash
# Watch logs
tail -f logs/ml-optimizer.log

# Check metrics
curl http://localhost:3000/api/ml-metrics
```

### Dashboard

Access ML statistics:
- Prediction confidence trends
- Optimization actions taken
- Anomaly alerts
- Resource allocation history

## Configuration Tuning

### For High Traffic

```typescript
mlOptimizer({
  trainingInterval: 10, // More frequent training
  predictionThreshold: 0.6, // Lower threshold
  optimization: {
    targetLatency: 30, // Stricter target
    maxMemory: 2048,
  },
})
```

### For Development

```typescript
mlOptimizer({
  trainingInterval: 60,
  predictionThreshold: 0.9, // Less aggressive
  features: {
    performancePrediction: true,
    anomalyDetection: false, // Disable in dev
  },
})
```

## Troubleshooting

### High Memory Usage

Reduce metrics retention:
```typescript
metrics: {
  retentionPeriod: 12, // 12 hours instead of 24
}
```

### Too Many False Positives

Increase thresholds:
```typescript
predictionThreshold: 0.9,
optimization: {
  targetLatency: 200,
}
```

### Slow Training

Train less frequently:
```typescript
trainingInterval: 60, // Every hour
```

## Best Practices

1. **Set appropriate priorities** for critical endpoints
2. **Track query executions** for optimization insights
3. **Monitor ML headers** to validate optimizations
4. **Adjust thresholds** based on your workload
5. **Keep metrics retention** reasonable for your scale

## License

MIT
