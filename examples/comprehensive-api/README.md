# OpenSpeed Comprehensive API Example

A production-ready REST API example showcasing OpenSpeed's powerful features including database integration, security, file uploads, and best practices.

## Features Demonstrated

- ✅ **Security**: CORS, CSRF protection, input validation
- ✅ **Database**: MongoDB integration with encryption
- ✅ **RESTful API**: Complete CRUD operations
- ✅ **File Upload**: Secure file handling with validation
- ✅ **Pagination**: Efficient data pagination and filtering
- ✅ **Error Handling**: Comprehensive error management
- ✅ **Logging**: Request/response logging middleware
- ✅ **API Versioning**: Clean API versioning structure

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB connection string
   ```

3. **Start the development server:**
   ```bash
   pnpm run dev
   ```

4. **Test the API:**
   ```bash
   # Health check
   curl http://localhost:3000/health

   # Get users
   curl http://localhost:3000/api/v1/users

   # Create a user
   curl -X POST http://localhost:3000/api/v1/users \
     -H "Content-Type: application/json" \
     -d '{"name":"John Doe","email":"john@example.com"}'
   ```

## API Endpoints

### Health Check
```
GET /health
```
Returns server health status and uptime.

### Users API
```
GET    /api/v1/users           # List all users
GET    /api/v1/users/:id       # Get user by ID
POST   /api/v1/users           # Create new user
PUT    /api/v1/users/:id       # Update user
DELETE /api/v1/users/:id       # Delete user
```

### Products API (with filtering & pagination)
```
GET /api/v1/products?page=1&limit=10&category=electronics&minPrice=100&maxPrice=500&search=laptop
```

### File Upload
```
POST /api/v1/upload
Content-Type: multipart/form-data
```

## Environment Variables

Create a `.env` file with:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=mongodb://localhost:27017/openspeed-api
DB_ENCRYPTION_KEY=your-encryption-key-here

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Project Structure

```
src/
├── index.ts              # Main application with all routes
├── middleware/           # Custom middleware (if needed)
├── models/              # Data models (if needed)
├── routes/              # Route handlers (if splitting up)
├── plugins/             # Custom plugins (if needed)
└── utils/               # Utility functions (if needed)
```

## Key Features Explained

### Security First
- **CORS Protection**: Configurable origins with credentials support
- **Security Headers**: Comprehensive security middleware
- **Input Validation**: Automatic sanitization and validation
- **Rate Limiting**: Built-in protection against abuse

### Database Integration
- **MongoDB Support**: Native MongoDB driver integration
- **Encryption**: Automatic field encryption for sensitive data
- **Connection Pooling**: Efficient connection management
- **Query Logging**: Security monitoring and debugging

### RESTful Design
- **Standard HTTP Methods**: GET, POST, PUT, DELETE
- **Proper Status Codes**: 200, 201, 400, 404, 409, 500
- **JSON Responses**: Consistent response format
- **Error Handling**: Structured error responses

### Production Ready
- **Logging**: Request/response logging
- **Health Checks**: Service monitoring endpoints
- **Graceful Shutdown**: Proper cleanup on exit
- **Environment Config**: Flexible configuration

## Extending the API

### Adding New Endpoints

```typescript
// Add to your routes
api.get('/posts', async (ctx) => {
  const posts = await ctx.db.collection('posts').find({}).toArray();
  return ctx.json({ success: true, data: posts });
});
```

### Adding Middleware

```typescript
// Custom authentication middleware
app.use(async (ctx, next) => {
  const token = ctx.req.headers.authorization;
  if (!token) {
    return ctx.json({ error: 'Unauthorized' }, 401);
  }
  // Validate token...
  await next();
});
```

### Database Operations

```typescript
// Using the database plugin
const users = await ctx.db.collection('users').find({}).toArray();
const user = await ctx.db.collection('users').findOne({ email: 'user@example.com' });
await ctx.db.collection('users').insertOne(newUser);
```

## Testing

Run tests with:
```bash
pnpm test
```

## Deployment

### Docker
```bash
docker build -t openspeed-api .
docker run -p 3000:3000 openspeed-api
```

### Production
```bash
pnpm run build
pnpm start
```

## Learn More

- [OpenSpeed Documentation](https://openspeed.dev)
- [API Reference](https://openspeed.dev/api)
- [Plugin Ecosystem](https://openspeed.dev/plugins)