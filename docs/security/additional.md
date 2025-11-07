---
layout: default
title: Additional
parent: Security
nav_order: 4
---

# OpenSpeed Additional Security Components

## Overview

This document covers security enhancements for additional OpenSpeed components including file uploads, WebSocket connections, GraphQL APIs, and other potential attack vectors.

## File Upload Security

### Security Features

#### File Type Validation
```typescript
const uploadOptions = {
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
};
```

#### Filename Security
- **Path Traversal Prevention**: Blocks `../` and absolute paths
- **Hidden File Protection**: Prevents `.htaccess`, `.env` uploads
- **System File Protection**: Blocks `con`, `prn`, `aux`, etc.
- **Secure Filename Generation**: Creates hash-based filenames

#### File Size Limits
```typescript
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB per file
  files: 10, // Max 10 files per request
};
```

#### Malware Detection
- **Signature-based Scanning**: Detects EICAR test virus and common patterns
- **Content Analysis**: Scans first 1KB for malicious content
- **Automatic Quarantine**: Moves suspicious files to quarantine directory

#### Rate Limiting
```typescript
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxUploads: 10, // Max 10 uploads per window
};
```

### Usage Example
```typescript
import { upload, single } from 'openspeed/plugins/upload';

app.use(upload({
  allowedTypes: ['image/jpeg', 'image/png'],
  allowedExtensions: ['.jpg', '.png'],
  scanForMalware: true,
  secureFilename: true,
  rateLimit: { windowMs: 900000, maxUploads: 10 },
}));

app.post('/upload', single('avatar'), (ctx) => {
  const file = ctx.req.file;
  if (!file) return ctx.json({ error: 'No file uploaded' }, 400);
  
  return ctx.json({
    filename: file.filename,
    size: file.size,
    secure: true
  });
});
```

## WebSocket Security

### Connection Security

#### Origin Validation
```typescript
const wsOptions = {
  allowedOrigins: ['https://myapp.com', 'https://admin.myapp.com'],
  requireSecure: true, // Force wss://
};
```

#### Connection Limits
```typescript
const wsOptions = {
  maxConnections: 1000, // Global limit
  maxConnectionsPerIP: 10, // Per IP limit
};
```

#### Message Security
```typescript
const wsOptions = {
  maxMessageSize: 64 * 1024, // 64KB max message
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxMessages: 100, // Max 100 messages per minute
  },
};
```

### Room Security

#### Authorization-Based Rooms
```typescript
import { wsRoom } from 'openspeed/plugins/websocket';

// Authorize users for specific rooms
wsRoom.authorizeRoom('admin-chat', ['user1', 'user2']);
wsRoom.authorizeRoom('private-room', ['vip-user']);

// Join with authorization check
const success = wsRoom.join(ws, 'admin-chat', userId);
if (!success) {
  ws.close(1008, 'Unauthorized');
}
```

#### Secure Broadcasting
```typescript
// Broadcast with error handling
wsRoom.broadcast('public-chat', message, excludeSender);

// Check room membership
const members = wsRoom.getRoomSize('private-room');
const authorizedUsers = wsRoom.getAuthorizedUsers('admin-room');
```

### Usage Example
```typescript
import { websocket, wsRoom } from 'openspeed/plugins/websocket';

app.use(websocket('/ws', {
  message: (ws, message, clientInfo) => {
    console.log(`Message from ${clientInfo.ip}: ${message}`);
    
    // Join room with authorization
    if (clientInfo.authenticated) {
      wsRoom.join(ws, 'authenticated-users', clientInfo.userId);
    }
    
    wsRoom.broadcast('public', `User: ${message}`);
  },
  open: (ws, clientInfo) => {
    console.log(`WebSocket opened from ${clientInfo.ip}`);
  },
  close: (ws, code, reason, clientInfo) => {
    console.log(`WebSocket closed: ${reason}`);
    wsRoom.cleanup(ws);
  }
}, {
  allowedOrigins: ['https://myapp.com'],
  requireSecure: true,
  maxMessageSize: 65536,
  rateLimit: { windowMs: 60000, maxMessages: 100 },
}));
```

## GraphQL Security

### Query Protection

#### Depth Limiting
```typescript
const graphqlOptions = {
  maxQueryDepth: 5, // Prevent deep nested queries
  maxQueryComplexity: 100, // Limit query complexity score
};
```

#### Input Sanitization
```typescript
const graphqlOptions = {
  sanitizeInputs: true, // Remove dangerous characters
};
```

#### Rate Limiting
```typescript
const graphqlOptions = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxQueries: 100, // Max 100 queries per window
  },
};
```

#### Authentication & Authorization
```typescript
const graphqlOptions = {
  requireAuth: true, // Require authentication for all queries
  allowedOrigins: ['https://myapp.com'], // CORS protection
};
```

### Production Hardening
```typescript
const graphqlOptions = {
  introspection: false, // Disable in production
  playground: false, // Disable GraphQL playground
  disablePlaygroundInProduction: true,
};
```

### Usage Example
```typescript
import { graphqlPlugin } from 'openspeed/plugins/graphql';

const typeDefs = `
  type Query {
    user(id: ID!): User
    users: [User!]!
  }
  
  type User {
    id: ID!
    name: String!
    email: String!
  }
`;

const resolvers = {
  Query: {
    user: (parent, { id }, context) => {
      // Check permissions
      if (!context.user) throw new Error('Unauthorized');
      return getUserById(id);
    },
    users: (parent, args, context) => {
      // Rate limiting and authorization checks
      return getUsers();
    },
  },
};

app.use(graphqlPlugin({
  schema: typeDefs,
  resolvers,
  maxQueryDepth: 5,
  maxQueryComplexity: 100,
  requireAuth: true,
  sanitizeInputs: true,
  rateLimit: { windowMs: 900000, maxQueries: 100 },
  disablePlaygroundInProduction: true,
}));
```

## Cache Security

### Cache Poisoning Prevention

#### Cache Key Sanitization
```typescript
// Secure cache key generation
function createSecureCacheKey(req: Request): string {
  const url = new URL(req.url);
  
  // Remove sensitive parameters
  const safeParams = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (!['api_key', 'token', 'password'].includes(key)) {
      safeParams.set(key, value);
    }
  }
  
  return `${req.method}:${url.pathname}?${safeParams.toString()}`;
}
```

#### Cache TTL Security
```typescript
const cacheOptions = {
  ttl: {
    public: 300, // 5 minutes for public data
    private: 60, // 1 minute for user-specific data
    sensitive: 30, // 30 seconds for sensitive data
  },
};
```

### Cache Implementation
```typescript
import { createClient } from 'redis';

class SecureCache {
  private client = createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
      tls: true, // Use TLS for Redis connections
      rejectUnauthorized: true,
    },
  });

  async get(key: string): Promise<any> {
    const sanitizedKey = this.sanitizeKey(key);
    return this.client.get(sanitizedKey);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const sanitizedKey = this.sanitizeKey(key);
    const serializedValue = JSON.stringify(value);
    
    if (ttl) {
      await this.client.setEx(sanitizedKey, ttl, serializedValue);
    } else {
      await this.client.set(sanitizedKey, serializedValue);
    }
  }

  private sanitizeKey(key: string): string {
    // Remove dangerous characters from cache keys
    return key.replace(/[<>'"&\\]/g, '_');
  }
}
```

## Environment Variables Security

### Secure Configuration
```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/db
DB_ENCRYPTION_KEY=32-character-encryption-key-here

# Authentication
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
CSRF_SECRET=your-csrf-secret

# External Services
REDIS_URL=rediss://user:password@host:port # Note: rediss:// for TLS
SMTP_PASSWORD=your-smtp-password
API_KEY=your-external-api-key

# Security Features
DB_ENCRYPTION=true
DB_AUDIT_LOG=true
NODE_ENV=production
```

### Environment Validation
```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  DB_ENCRYPTION_KEY: z.string().length(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

const env = envSchema.parse(process.env);

// Use validated environment variables
console.log('Environment validated successfully');
```

## Dependency Security

### Vulnerability Scanning
```bash
# Check for vulnerabilities
npm audit
npm audit fix

# Use npm audit in CI/CD
- name: Security Audit
  run: npm audit --audit-level=moderate
```

### Dependency Management
```json
{
  "scripts": {
    "audit": "npm audit --audit-level=high",
    "audit:fix": "npm audit fix --audit-level=moderate"
  }
}
```

### Lock File Security
```bash
# Ensure lock files are committed
git add package-lock.json
git add pnpm-lock.yaml

# Verify lock file integrity
npm ci --dry-run
```

## Error Handling Security

### Information Disclosure Prevention
```typescript
import { errorHandler } from 'openspeed/plugins/errorHandler';

app.use(errorHandler({
  exposeStack: process.env.NODE_ENV === 'development', // Never in production
  includeDetails: process.env.NODE_ENV === 'development',
  transformError: (error, ctx) => {
    // Log full error internally
    console.error('Internal error:', error);
    
    // Return sanitized error to client
    if (process.env.NODE_ENV === 'production') {
      return {
        error: {
          message: 'Internal server error',
          status: 500,
        }
      };
    }
    
    return {
      error: {
        message: error.message,
        status: 500,
        stack: error.stack,
      }
    };
  },
}));
```

## Logging Security

### Secure Logging Practices
```typescript
class SecureLogger {
  private sanitizeLogData(data: any): any {
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      
      // Remove sensitive fields
      const sensitiveFields = ['password', 'token', 'apiKey', 'creditCard'];
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });
      
      return sanitized;
    }
    
    return data;
  }

  log(level: string, message: string, data?: any): void {
    const sanitizedData = data ? this.sanitizeLogData(data) : undefined;
    console.log(`[${level.toUpperCase()}] ${message}`, sanitizedData);
  }
}

const logger = new SecureLogger();
logger.log('info', 'User login', { userId: '123', token: 'secret-token' });
// Output: [INFO] User login { userId: '123', token: '[REDACTED]' }
```

## Performance Security

### Resource Exhaustion Protection
```typescript
import { rateLimit } from 'openspeed/plugins/rateLimit';

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
}));
```

### Memory Limit Protection
```typescript
import { memoryPlugin } from 'openspeed/plugins/memory';

app.use(memoryPlugin({
  maxHeapSize: 512, // 512MB heap limit
  gcThreshold: 0.8, // Trigger GC at 80% usage
  enableGC: true,
}));
```

## Testing Security

### Security Test Examples
```typescript
describe('Security Tests', () => {
  it('should prevent SQL injection in GraphQL', async () => {
    const maliciousQuery = `
      query {
        user(id: "1' OR '1'='1") {
          name
        }
      }
    `;
    
    const response = await request(app)
      .post('/graphql')
      .send({ query: maliciousQuery });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('invalid');
  });

  it('should rate limit file uploads', async () => {
    // Upload multiple files rapidly
    const uploads = Array(15).fill().map(() =>
      request(app)
        .post('/upload')
        .attach('file', Buffer.from('test'), 'test.txt')
    );
    
    const responses = await Promise.all(uploads);
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should validate WebSocket origins', async () => {
    const ws = new WebSocket('ws://localhost:3000/ws', {
      headers: { Origin: 'http://malicious-site.com' }
    });
    
    // Should be rejected
    await expect(new Promise(resolve => {
      ws.on('error', resolve);
    })).resolves.toBeDefined();
  });
});
```

## Compliance Considerations

### GDPR Compliance
- Data encryption at rest and in transit
- Right to erasure (data deletion)
- Audit logging for data access
- Consent management for cookies

### Security Headers
```typescript
app.use((ctx) => {
  ctx.res.headers = {
    ...ctx.res.headers,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
});
```

## Monitoring & Alerting

### Security Monitoring
```typescript
// Monitor security events
app.use((ctx, next) => {
  const start = Date.now();
  
  return next().then(() => {
    const duration = Date.now() - start;
    
    // Log suspicious activity
    if (ctx.res.status === 429) {
      alertSecurityTeam('Rate limit exceeded', { ip: getClientIP(ctx) });
    }
    
    if (duration > 10000) {
      alertSecurityTeam('Slow request', { url: ctx.req.url, duration });
    }
  });
});

function alertSecurityTeam(event: string, details: any): void {
  // Send to security monitoring system
  console.error(`[SECURITY ALERT] ${event}:`, details);
  // Could integrate with Slack, PagerDuty, etc.
}
```

---

**Last Updated:** October 30, 2025
**Version:** OpenSpeed v0.7.0