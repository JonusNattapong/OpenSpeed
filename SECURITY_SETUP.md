# OpenSpeed Security Setup Guide

## 🚀 Quick Start Security Checklist

This guide provides a **production-ready security setup** for OpenSpeed applications. Complete all items in order for maximum security.

---

## 📋 Pre-Deployment Checklist

### ✅ Environment Setup
- [ ] **HTTPS Only**: Ensure all traffic uses HTTPS in production
- [ ] **Domain Configuration**: Use a proper domain (not IP addresses)
- [ ] **SSL Certificate**: Valid SSL certificate from trusted CA
- [ ] **HSTS Headers**: Enable HTTP Strict Transport Security

### ✅ Secrets Generation
Run this command to generate all required secrets:

```bash
# Generate cryptographically secure secrets
node -e "
const crypto = require('crypto');
console.log('JWT_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('JWT_REFRESH_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('CSRF_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('DB_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));
console.log('COOKIE_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('hex'));
"
```

**Save these securely** - never commit to version control!

---

## 🔐 Environment Variables

### Required Production Variables

```bash
# ==========================================
# REQUIRED: Core Application Security
# ==========================================

# JWT Configuration
JWT_SECRET=your-32-character-jwt-secret-here
JWT_REFRESH_SECRET=your-32-character-refresh-secret-here
CSRF_SECRET=your-32-character-csrf-secret-here

# Database Security
DATABASE_URL=postgresql://user:secure_password@host:5432/dbname
DB_ENCRYPTION=true
DB_ENCRYPTION_KEY=your-32-character-encryption-key-here
DB_AUDIT_LOG=true

# Session & Cookie Security
COOKIE_SECRET=your-32-character-cookie-secret-here
SESSION_SECRET=your-32-character-session-secret-here

# ==========================================
# REQUIRED: External Services
# ==========================================

# Redis (for caching & sessions)
REDIS_URL=rediss://user:password@host:port/db  # Note: rediss:// for TLS

# Email Service (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourdomain.com

# ==========================================
# REQUIRED: Application Configuration
# ==========================================

# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# CORS Configuration
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com

# Security Features
ENABLE_RATE_LIMIT=true
ENABLE_CSRF=true
ENABLE_SECURITY_HEADERS=true
ENABLE_AUDIT_LOG=true

# ==========================================
# OPTIONAL: Advanced Features
# ==========================================

# File Upload Security
UPLOAD_MAX_SIZE=5242880  # 5MB
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,application/pdf
UPLOAD_RATE_LIMIT=10     # uploads per 15 minutes

# WebSocket Security
WS_MAX_CONNECTIONS=1000
WS_MAX_CONNECTIONS_PER_IP=10
WS_RATE_LIMIT=100       # messages per minute

# Database Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# Monitoring & Logging
LOG_LEVEL=info
ENABLE_PROMETHEUS=true
PROMETHEUS_PORT=9090
```

### Environment Validation Script

Create `scripts/validate-env.js`:

```javascript
const required = [
  'JWT_SECRET', 'JWT_REFRESH_SECRET', 'CSRF_SECRET',
  'DATABASE_URL', 'DB_ENCRYPTION_KEY', 'COOKIE_SECRET',
  'SESSION_SECRET', 'REDIS_URL', 'FRONTEND_URL'
];

const optional = [
  'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
  'UPLOAD_MAX_SIZE', 'WS_MAX_CONNECTIONS'
];

console.log('🔍 Validating environment variables...\n');

let missing = [];
let invalid = [];

required.forEach(key => {
  if (!process.env[key]) {
    missing.push(key);
  }
});

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`   - ${key}`));
  process.exit(1);
}

console.log('✅ All required environment variables present');

// Validate lengths
const secrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CSRF_SECRET', 'DB_ENCRYPTION_KEY'];
secrets.forEach(key => {
  if (process.env[key] && process.env[key].length !== 64) {
    invalid.push(`${key} (must be 64 hex characters)`);
  }
});

if (invalid.length > 0) {
  console.error('❌ Invalid environment variables:');
  invalid.forEach(item => console.error(`   - ${item}`));
  process.exit(1);
}

console.log('✅ All secrets have correct length');
console.log('🎉 Environment validation passed!');
```

Run validation:

```bash
node scripts/validate-env.js
```

---

## 🛡️ Security Configuration

### 1. Application Security Setup

```typescript
// server.ts
import { createApp } from 'openspeed';
import {
  cors, rateLimit, security, errorHandler,
  database, cache, session
} from 'openspeed/plugins';

const app = createApp();

// ==========================================
// SECURITY MIDDLEWARE (Order Matters!)
// ==========================================

// 1. Security Headers (must be first)
app.use(security({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameOptions: 'DENY',
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin'
}));

// 2. CORS Configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [process.env.FRONTEND_URL],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 86400
}));

// 3. Rate Limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (ctx) => {
    // Skip health checks
    return ctx.path === '/health';
  }
}));

// 4. Database with Security
app.use(database({
  type: 'postgresql',
  connection: process.env.DATABASE_URL,
  encryptionKey: process.env.DB_ENCRYPTION_KEY,
  enableQueryLogging: true,
  enableAuditLog: true,
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000')
  }
}));

// 5. Session Management
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS only
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// 6. Error Handler (must be last)
app.use(errorHandler({
  exposeStack: false, // Never expose in production
  includeDetails: false,
  transformError: (error, ctx) => {
    // Log full error internally
    console.error('Production Error:', {
      message: error.message,
      stack: error.stack,
      url: ctx.path,
      method: ctx.method,
      ip: ctx.getHeader('x-forwarded-for') || ctx.getHeader('x-real-ip'),
      userAgent: ctx.getHeader('user-agent'),
      timestamp: new Date().toISOString()
    });

    // Return sanitized error
    return {
      error: {
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        status: 500
      }
    };
  }
}));

// ==========================================
// HEALTH CHECK ENDPOINT
// ==========================================

app.get('/health', async (ctx) => {
  try {
    // Check database connectivity
    await ctx.db?.query('SELECT 1');

    return ctx.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime()
    });
  } catch (error) {
    return ctx.json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    }, 503);
  }
});

// ==========================================
// SECURE ROUTES EXAMPLE
// ==========================================

// Public routes
app.get('/', (ctx) => ctx.text('OpenSpeed API - Production Ready'));

// Protected routes would go here with authentication middleware

export default app;
```

### 2. Database Security Setup

#### PostgreSQL Production Configuration

```sql
-- Create production database user with minimal privileges
CREATE USER openspeed_prod WITH PASSWORD 'your-secure-password-here';
GRANT CONNECT ON DATABASE openspeed_prod TO openspeed_prod;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO openspeed_prod;

-- Grant table permissions (adjust based on your schema)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openspeed_prod;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO openspeed_prod;

-- Create separate user for migrations (with DDL permissions)
CREATE USER openspeed_migrate WITH PASSWORD 'migration-password-here';
GRANT ALL PRIVILEGES ON DATABASE openspeed_prod TO openspeed_migrate;
GRANT ALL ON SCHEMA public TO openspeed_migrate;

-- Enable Row Level Security (RLS) for multi-tenant apps
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, old_values, new_values, user_id, timestamp)
  VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), current_setting('app.user_id', true), now());
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to sensitive tables
CREATE TRIGGER users_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

#### Database Backup Security

```bash
# Secure backup script
#!/bin/bash

BACKUP_DIR="/secure/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/openspeed_$TIMESTAMP.sql.gz"

# Create backup with encryption
pg_dump -h localhost -U openspeed_prod openspeed_prod | \
  gzip | \
  openssl enc -aes-256-cbc -salt -out "$BACKUP_FILE" -k "$BACKUP_ENCRYPTION_KEY"

# Set secure permissions
chmod 600 "$BACKUP_FILE"

# Rotate old backups (keep last 30 days)
find "$BACKUP_DIR" -name "openspeed_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

### 3. Redis Security Setup

#### Redis Production Configuration

```redis.conf
# Security settings
bind 127.0.0.1 ::1
protected-mode yes
port 6379

# TLS/SSL (if using rediss://)
tls-port 6380
tls-cert-file /path/to/redis.crt
tls-key-file /path/to/redis.key
tls-ca-cert-file /path/to/ca.crt

# Authentication
requirepass your-secure-redis-password

# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile /var/log/redis/redis.log

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command SHUTDOWN SHUTDOWN_REDIS
```

#### Redis Connection in Application

```typescript
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL, // rediss:// for TLS
  socket: {
    tls: true,
    rejectUnauthorized: true,
  },
  password: process.env.REDIS_PASSWORD,
});

// Handle connection errors
redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
  // Implement retry logic or fallback
});

redisClient.on('connect', () => {
  console.log('Connected to Redis securely');
});
```

---

## 🔍 Security Testing & Validation

### Automated Security Tests

Create `tests/security.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server';

describe('Security Tests', () => {
  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(105).fill().map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('should allow configured origins', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', process.env.FRONTEND_URL);

      expect(response.headers['access-control-allow-origin']).toBe(process.env.FRONTEND_URL);
    });

    it('should reject unauthorized origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://malicious-site.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Input Validation', () => {
    it('should reject malicious input', async () => {
      const maliciousData = {
        email: "admin'; DROP TABLE users; --",
        password: '<script>alert("xss")</script>'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(maliciousData);

      expect(response.status).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should not expose internal errors', async () => {
      // Trigger an internal error
      const response = await request(app).get('/nonexistent-route-that-causes-error');

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Internal server error');
      expect(response.body.error.stack).toBeUndefined();
    });
  });
});
```

### Security Scanning

```bash
# Run security tests
npm run test:security

# Scan dependencies for vulnerabilities
npm audit --audit-level=moderate

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated

# Update dependencies securely
npm update --save
```

---

## 📊 Monitoring & Alerting

### Application Monitoring

```typescript
import { metrics, healthCheck } from 'openspeed/plugins';

// Enable Prometheus metrics
app.use(metrics({
  prefix: 'openspeed_',
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true
}));

// Health check endpoint
app.get('/metrics', async (ctx) => {
  return ctx.text(await metrics.getMetrics(), {
    'Content-Type': 'text/plain; charset=utf-8'
  });
});
```

### Log Aggregation

```typescript
import winston from 'winston';

// Secure logging configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'openspeed' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// If we're not in production then log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

export default logger;
```

### Alert Configuration

```typescript
// Alert on security events
const alertThresholds = {
  rateLimitExceeded: 10, // Alert if > 10 rate limit violations per minute
  failedLogins: 5,       // Alert if > 5 failed logins per minute
  suspiciousRequests: 3,  // Alert if > 3 suspicious requests per minute
};

function sendAlert(type: string, details: any) {
  // Implement your alerting mechanism
  // Options: Slack, PagerDuty, email, SMS, etc.

  console.error(`🚨 SECURITY ALERT: ${type}`, {
    timestamp: new Date().toISOString(),
    details,
    environment: process.env.NODE_ENV,
    hostname: require('os').hostname()
  });

  // Example: Send to Slack
  // fetch(process.env.SLACK_WEBHOOK_URL, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     text: `🚨 Security Alert: ${type}`,
  //     attachments: [{ text: JSON.stringify(details, null, 2) }]
  //   })
  // });
}
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Secrets generated and stored securely
- [ ] SSL certificate installed and configured
- [ ] Domain DNS configured
- [ ] Database created and secured
- [ ] Redis configured with TLS
- [ ] Email service configured

### Security Configuration
- [ ] HTTPS enforced
- [ ] Security headers enabled
- [ ] CORS properly configured
- [ ] Rate limiting active
- [ ] CSRF protection enabled
- [ ] Input validation implemented
- [ ] Error handling configured
- [ ] Audit logging enabled

### Testing
- [ ] Security tests passing
- [ ] Dependency vulnerabilities checked
- [ ] Penetration testing completed
- [ ] Load testing performed

### Monitoring
- [ ] Application monitoring configured
- [ ] Log aggregation set up
- [ ] Alerting configured
- [ ] Backup strategy implemented

### Post-Deployment
- [ ] Health checks passing
- [ ] Monitoring dashboards active
- [ ] Backup verification completed
- [ ] Incident response plan documented

---

## 🆘 Emergency Response

### Security Incident Response

1. **Contain the Breach**
   - Isolate affected systems
   - Revoke compromised credentials
   - Block malicious IP addresses

2. **Assess the Damage**
   - Review audit logs
   - Identify exposed data
   - Determine breach scope

3. **Notify Affected Parties**
   - Users whose data was exposed
   - Regulatory authorities (if required)
   - Insurance providers

4. **Remediate**
   - Patch vulnerabilities
   - Rotate all secrets
   - Update security configurations

5. **Prevent Future Incidents**
   - Conduct post-mortem analysis
   - Implement additional security measures
   - Update incident response plan

### Contact Information

- **Security Team**: security@openspeed.dev
- **Emergency Hotline**: +1-XXX-XXX-XXXX
- **PGP Key**: Available at https://keys.openspeed.dev

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [OpenSpeed Security Documentation](../docs/security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Remember**: Security is an ongoing process. Regularly review and update your security measures as threats evolve.

🛡️ **Stay Secure!** 🛡️