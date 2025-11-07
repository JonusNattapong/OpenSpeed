---
layout: default
title: Troubleshooting
nav_order: 14
---

# OpenSpeed Troubleshooting Guide

This guide helps you resolve common issues when working with OpenSpeed. If you can't find a solution here, please [open an issue](https://github.com/JonusNattapong/OpenSpeed/issues) on GitHub.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [Performance Problems](#performance-problems)
- [Plugin Issues](#plugin-issues)
- [Database Problems](#database-problems)
- [Security Issues](#security-issues)
- [Build and Deployment](#build-and-deployment)
- [Testing Problems](#testing-problems)

## Installation Issues

### npm install fails

**Problem**: `npm install` fails with permission errors or network issues.

**Solutions**:

1. **Clear npm cache**:
   ```bash
   npm cache clean --force
   npm install
   ```

2. **Use different registry**:
   ```bash
   npm config set registry https://registry.npmjs.org/
   npm install
   ```

3. **Install with verbose logging**:
   ```bash
   npm install --verbose
   ```

4. **Check Node.js version**:
   ```bash
   node --version  # Should be >= 18.0.0
   ```

### Module not found errors

**Problem**: `Cannot find module 'openspeed-framework'`

**Solutions**:

1. **Reinstall dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check package.json**:
   ```json
   {
     "dependencies": {
       "openspeed-framework": "^1.0.4"
     }
   }
   ```

3. **Use correct import**:
   ```typescript
   import { createApp } from 'openspeed-framework';
   ```

## Runtime Errors

### Port already in use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:

1. **Kill process on port**:
   ```bash
   # Find process
   lsof -i :3000
   # Kill process
   kill -9 <PID>
   ```

2. **Use different port**:
   ```typescript
   await app.listen(3001);
   ```

3. **Auto-select port**:
   ```typescript
   const server = await app.listen(0); // Auto-assigns port
   console.log(`Server running on port ${server.port}`);
   ```

### TypeScript compilation errors

**Problem**: TypeScript errors during development or build.

**Solutions**:

1. **Check TypeScript version**:
   ```bash
   npx tsc --version  # Should be >= 5.0.0
   ```

2. **Run type checking**:
   ```bash
   npm run typecheck
   ```

3. **Fix common issues**:
   - Ensure all imports are correct
   - Check for missing type definitions
   - Update `@types/*` packages

4. **tsconfig.json issues**:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ESNext",
       "moduleResolution": "node",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     }
   }
   ```

## Performance Problems

### Slow startup time

**Problem**: Application takes too long to start.

**Solutions**:

1. **Enable production mode**:
   ```bash
   NODE_ENV=production npm start
   ```

2. **Use Bun or optimize Node.js**:
   ```bash
   bun run start  # Faster startup than Node.js
   ```

3. **Lazy load plugins**:
   ```typescript
   // Instead of importing all at once
   const auth = await import('./plugins/auth.js');
   ```

### High memory usage

**Problem**: Application uses too much memory.

**Solutions**:

1. **Enable memory optimization**:
   ```typescript
   import { memoryPlugin } from 'openspeed/plugins/memory';
   
   app.use(memoryPlugin({
     maxHeapSize: 512, // MB
     gcThreshold: 0.8
   }));
   ```

2. **Use streaming for large responses**:
   ```typescript
   return ctx.stream(largeDataGenerator());
   ```

3. **Monitor memory usage**:
   ```bash
   node --inspect server.js
   # Open Chrome DevTools → Memory tab
   ```

### Slow response times

**Problem**: API responses are slow.

**Solutions**:

1. **Enable caching**:
   ```typescript
   import { cache } from 'openspeed/plugins/cache';
   
   app.use(cache({
     ttl: 300, // 5 minutes
     maxSize: 1000
   }));
   ```

2. **Use compression**:
   ```typescript
   import { compression } from 'openspeed/plugins/compression';
   
   app.use(compression({
     threshold: 1024,
     level: 6
   }));
   ```

3. **Profile performance**:
   ```bash
   npm run benchmark
   # Or use clinic.js
   npx clinic doctor -- node server.js
   ```

## Plugin Issues

### Plugin not loading

**Problem**: Plugin fails to load or initialize.

**Solutions**:

1. **Check plugin compatibility**:
   ```typescript
   console.log('OpenSpeed version:', require('openspeed-framework/package.json').version);
   ```

2. **Verify plugin installation**:
   ```bash
   npm list openspeed-plugin-name
   ```

3. **Check plugin configuration**:
   ```typescript
   try {
     app.use(plugin(options));
   } catch (error) {
     console.error('Plugin failed to load:', error);
   }
   ```

### Plugin conflicts

**Problem**: Multiple plugins interfere with each other.

**Solutions**:

1. **Check plugin order**:
   ```typescript
   // Security plugins first
   app.use(cors());
   app.use(rateLimit());
   
   // Then other plugins
   app.use(logger());
   app.use(database());
   ```

2. **Isolate plugins**:
   ```typescript
   // Test one plugin at a time
   const app = createApp();
   app.use(problematicPlugin());
   // Add routes and test
   ```

3. **Check plugin documentation** for known conflicts.

## Database Problems

### Connection failures

**Problem**: Database connection fails.

**Solutions**:

1. **Check connection string**:
   ```bash
   # Test connection
   psql "postgresql://user:pass@host:port/db" -c "SELECT 1"
   ```

2. **Verify environment variables**:
   ```bash
   echo $DATABASE_URL
   ```

3. **Check database server**:
   ```bash
   # PostgreSQL
   sudo systemctl status postgresql
   
   # MySQL
   sudo systemctl status mysql
   ```

4. **Use connection pooling**:
   ```typescript
   app.use(database({
     type: 'postgresql',
     connection: process.env.DATABASE_URL,
     pool: {
       min: 2,
       max: 20,
       idleTimeoutMillis: 30000
     }
   }));
   ```

### Query timeouts

**Problem**: Database queries timeout.

**Solutions**:

1. **Increase timeout**:
   ```typescript
   app.use(database({
     queryTimeout: 30000, // 30 seconds
     connectionTimeoutMillis: 60000
   }));
   ```

2. **Optimize queries**:
   ```sql
   -- Add indexes
   CREATE INDEX idx_users_email ON users(email);
   
   -- Use EXPLAIN to analyze queries
   EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
   ```

3. **Use read replicas**:
   ```typescript
   app.use(database({
     readReplicas: ['replica1-url', 'replica2-url']
   }));
   ```

## Security Issues

### CORS errors

**Problem**: Browser blocks cross-origin requests.

**Solutions**:

1. **Configure CORS properly**:
   ```typescript
   app.use(cors({
     origin: process.env.FRONTEND_URL,
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE'],
     headers: ['Content-Type', 'Authorization']
   }));
   ```

2. **Check preflight requests**:
   ```bash
   curl -X OPTIONS -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: POST" \
        -v http://localhost:3000/api/data
   ```

### Authentication failures

**Problem**: Users can't log in or access protected routes.

**Solutions**:

1. **Check JWT configuration**:
   ```typescript
   app.use(jwt({
     secret: process.env.JWT_SECRET,
     expiresIn: '1h'
   }));
   ```

2. **Verify token format**:
   ```bash
   # Decode JWT
   node -e "
   const jwt = require('jsonwebtoken');
   const token = 'your-jwt-token';
   console.log(jwt.decode(token));
   "
   ```

3. **Check middleware order**:
   ```typescript
   // Auth middleware before protected routes
   app.use('/api/protected/*', authMiddleware);
   ```

### Rate limiting issues

**Problem**: Legitimate requests are being blocked.

**Solutions**:

1. **Adjust rate limits**:
   ```typescript
   app.use(rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // Increase if needed
     skip: (ctx) => ctx.getHeader('x-api-key') === 'trusted-key'
   }));
   ```

2. **Use different strategies**:
   ```typescript
   // IP-based (default)
   // User-based
   // API key-based
   ```

## Build and Deployment

### Build failures

**Problem**: `npm run build` fails.

**Solutions**:

1. **Check TypeScript errors**:
   ```bash
   npm run typecheck
   ```

2. **Clear build cache**:
   ```bash
   rm -rf dist/
   npm run build
   ```

3. **Check dependencies**:
   ```bash
   npm ls --depth=0
   ```

4. **Update build tools**:
   ```bash
   npm update typescript @types/node
   ```

### Docker build issues

**Problem**: Docker build fails.

**Solutions**:

1. **Check Dockerfile**:
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build with no cache**:
   ```bash
   docker build --no-cache -t openspeed-app .
   ```

3. **Check logs**:
   ```bash
   docker build -t openspeed-app . 2>&1 | tee build.log
   ```

### Production deployment issues

**Problem**: Application works locally but fails in production.

**Solutions**:

1. **Environment differences**:
   - Check all environment variables
   - Verify database connectivity
   - Test external service connections

2. **Build differences**:
   ```bash
   # Build for production
   NODE_ENV=production npm run build
   ```

3. **Memory limits**:
   ```bash
   # Check available memory
   free -h
   # Increase Node.js memory if needed
   node --max-old-space-size=4096 server.js
   ```

## Testing Problems

### Tests failing

**Problem**: Unit or integration tests fail.

**Solutions**:

1. **Run tests with verbose output**:
   ```bash
   npm test -- --verbose
   ```

2. **Check test environment**:
   ```typescript
   // In test setup
   process.env.NODE_ENV = 'test';
   process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/testdb';
   ```

3. **Mock external dependencies**:
   ```typescript
   import { vi } from 'vitest';
   
   vi.mock('openspeed/plugins/database', () => ({
     database: vi.fn(() => ({
       query: vi.fn().mockResolvedValue([])
     }))
   }));
   ```

4. **Check test coverage**:
   ```bash
   npm run test:coverage
   ```

### Integration test timeouts

**Problem**: Integration tests timeout.

**Solutions**:

1. **Increase timeout**:
   ```typescript
   it('should respond within timeout', async () => {
     const response = await request(app)
       .get('/api/data')
       .timeout(5000); // 5 seconds
     expect(response.status).toBe(200);
   }, 10000); // Test timeout
   ```

2. **Use test database**:
   ```typescript
   beforeAll(async () => {
     // Setup test database
     await setupTestDb();
   });
   
   afterAll(async () => {
     // Cleanup
     await teardownTestDb();
   });
   ```

## Getting Help

### Debug Information

When reporting issues, include:

```bash
# System information
node --version
npm --version
uname -a

# Package versions
npm list openspeed-framework

# Environment (redact secrets)
env | grep -E "(NODE_ENV|DATABASE_URL|REDIS_URL)" | head -10

# Application logs
tail -n 50 logs/app.log
```

### Common Debug Commands

```bash
# Check application health
curl http://localhost:3000/health

# Monitor memory usage
node --inspect server.js &
# Open chrome://inspect

# Profile performance
npx clinic flame -- node server.js

# Check database connections
npx pg-isready -h localhost -p 5432

# Test API endpoints
curl -X GET http://localhost:3000/api/test \
  -H "Authorization: Bearer your-token"
```

### Community Support

- **GitHub Issues**: [Report bugs](https://github.com/JonusNattapong/OpenSpeed/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/JonusNattapong/OpenSpeed/discussions)
- **Documentation**: [Read the docs](https://jonusnattapong.github.io/OpenSpeed/)

---

**Last Updated**: November 7, 2024
**Version**: OpenSpeed v1.0.4