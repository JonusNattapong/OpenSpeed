# OpenSpeed DevTools Demo

This example demonstrates the powerful development tools built into OpenSpeed, including route visualization, performance monitoring, and an interactive API playground.

## Features

### 🛠️ Development Tools Included

- **Route Visualizer** (`/_routes`): See all your API routes in a beautiful dashboard
- **Performance Monitor** (`/_performance`): Track response times, identify bottlenecks, and monitor API health
- **DevTools Dashboard** (`/_devtools`): Unified dashboard combining all development tools
- **API Playground**: Test your endpoints directly from the browser

### 📊 API Endpoints

The demo includes a comprehensive REST API with the following endpoints:

#### Users API
- `GET /api/users` - List all users
- `POST /api/users` - Create a new user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

#### Posts API
- `GET /api/posts` - List all posts
- `POST /api/posts` - Create a new post

#### Utility Endpoints
- `GET /health` - Health check with system info
- `GET /api/slow` - Slow endpoint for performance testing
- `GET /api/error/500` - Simulate server error
- `GET /api/error/404` - Simulate not found error
- `GET /static/*` - Static file serving example
- `GET /ws` - WebSocket endpoint example

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Run the development server:**
   ```bash
   pnpm run dev
   ```

3. **Open your browser and visit:**
   - **Main API**: http://localhost:3000/api/users
   - **Route Visualizer**: http://localhost:3000/_routes
   - **Performance Monitor**: http://localhost:3000/_performance
   - **DevTools Dashboard**: http://localhost:3000/_devtools

## Using the Development Tools

### Route Visualizer
The route visualizer shows all registered routes in your application:
- Method and path for each route
- Handler function names
- Middleware applied to each route
- File and line number where routes are defined
- Real-time updates as you add new routes

### Performance Monitor
Track your API performance with detailed metrics:
- Response times for each endpoint
- Request per second rates
- Error rates and slow request detection
- Memory usage statistics
- Interactive charts and graphs
- Export performance data

### API Playground
Test your endpoints directly from the browser:
- Send GET, POST, PUT, DELETE requests
- Set custom headers
- Include request bodies
- View formatted responses
- Real-time testing without external tools

## Development Workflow

1. **Start the server** with `pnpm run dev`
2. **Visit the DevTools Dashboard** at `/_devtools`
3. **Make API requests** to see routes and performance data populate
4. **Use the API Playground** to test endpoints interactively
5. **Monitor performance** to identify bottlenecks
6. **Add new routes** and see them appear in real-time

## Performance Testing

Try these commands to see the performance monitor in action:

```bash
# Quick performance test
curl http://localhost:3000/api/users

# Load testing with multiple requests
for i in {1..10}; do curl -s http://localhost:3000/api/posts > /dev/null & done

# Test slow endpoint
curl http://localhost:3000/api/slow

# Test error handling
curl http://localhost:3000/api/error/500
```

## Configuration

The development tools can be configured when initializing:

```typescript
app.use(devTools({
  enabled: true,           // Enable/disable all tools
  routeVisualizer: true,   // Show route visualization
  performanceMonitor: true, // Track performance metrics
  playground: true,        // Enable API playground
  autoReload: true         // Auto-refresh dashboards
}));
```

## Benefits for Developers

- **Faster Development**: See your API structure at a glance
- **Performance Insights**: Identify slow endpoints and bottlenecks
- **Interactive Testing**: Test APIs without leaving your browser
- **Real-time Feedback**: Dashboards update as you develop
- **Better Debugging**: Detailed error information and request tracing
- **Documentation**: Self-documenting API through route visualization

This demo showcases how OpenSpeed's development tools make building and maintaining APIs more efficient and enjoyable!