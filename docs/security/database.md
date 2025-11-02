OpenSpeed\docs\security\database.md
# OpenSpeed Database Security Guide

## Overview

This document outlines the security measures implemented in OpenSpeed's database layer to protect against common database vulnerabilities and attacks.

## Security Features

### 1. Data Encryption at Rest

#### Field-Level Encryption
Sensitive fields are automatically encrypted before storage:

```typescript
const sensitiveFields = [
  'password', 'email', 'ssn', 'credit_card', 'api_key', 'secret', 'token', 'key'
];
```

#### Encryption Configuration
```bash
# Enable encryption
DB_ENCRYPTION=true
DB_ENCRYPTION_KEY=your-32-character-encryption-key
```

#### Encryption Algorithm
- **Algorithm**: AES-256-GCM
- **Key Length**: 32 bytes
- **IV Length**: 16 bytes
- **Authentication**: GCM mode provides integrity

### 2. Query Logging & Auditing

#### Comprehensive Query Logging
All database operations are logged for security monitoring:

```typescript
interface QueryLogEntry {
  timestamp: number;
  connection: string;
  operation: string;
  table?: string;
  collection?: string;
  query?: string;
  duration: number;
  success: boolean;
  clientIP?: string;
  userId?: string;
  error?: string;
}
```

#### Audit Configuration
```bash
# Enable audit logging
DB_AUDIT_LOG=true
```

#### Query Log Access
```typescript
import { getQueryLogs, clearQueryLogs } from 'openspeed/plugins/database';

// Get recent logs
const logs = getQueryLogs(100);

// Clear logs
clearQueryLogs();
```

### 3. Input Validation & Sanitization

#### SQL Injection Prevention
- **Parameterized Queries**: All SQL queries use parameterized statements
- **Input Validation**: Dangerous patterns are detected and blocked
- **Type Safety**: TypeScript ensures type-safe database operations

#### Dangerous Pattern Detection
```typescript
const dangerousPatterns = [
  /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
  /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\\x23)|(\%27)|(\%23)|(\%2D\\x2D))/i,
];
```

### 4. Connection Security

#### Connection Pooling
- **MySQL/PostgreSQL**: Configurable connection limits
- **MongoDB**: Built-in connection pooling
- **Redis**: Connection management with retry logic

#### Connection Configuration
```typescript
const dbConfig = {
  type: 'postgresql',
  connection: process.env.DATABASE_URL,
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
  },
  encryptionKey: process.env.DB_ENCRYPTION_KEY,
  enableQueryLogging: true,
  enableAuditLog: true,
};
```

### 5. Multi-Tenant Isolation

#### Database-Level Isolation
```typescript
const dbConfig = {
  multiTenant: true,
  tenantKey: 'x-tenant-id', // Header or query parameter
};
```

#### Tenant-Specific Databases
- **MongoDB**: Separate databases per tenant
- **SQL**: Schema/database isolation
- **Redis**: Key prefix isolation

### 6. Performance Monitoring

#### Query Performance Tracking
- Query execution time monitoring
- Slow query detection
- Connection pool statistics

#### Health Checks
```typescript
import { healthCheck } from 'openspeed/plugins/database';

const health = await healthCheck('main-db');
console.log(`Status: ${health.status}, Latency: ${health.latency}ms`);
```

## Database Plugin Usage

### Basic Setup
```typescript
import { database } from 'openspeed/plugins/database';

app.use(database('main-db', {
  type: 'postgresql',
  connection: process.env.DATABASE_URL,
  encryptionKey: process.env.DB_ENCRYPTION_KEY,
  enableQueryLogging: true,
}));

// Use in routes
app.get('/users', async (ctx) => {
  const users = await ctx.db.find('users');
  return ctx.json(users);
});
```

### Type-Safe Query Builders
```typescript
import { SQLQueryBuilder } from 'openspeed/plugins/database';

const userRepo = new SQLQueryBuilder<User>(pool, 'users', 'main-db', encryptionKey);

// Type-safe operations
const users = await userRepo.find({ active: true });
const user = await userRepo.findOne({ email: 'user@example.com' });
const newUser = await userRepo.insert({ name: 'John', email: 'john@example.com' });
```

### Encrypted Data Handling
```typescript
// Data is automatically encrypted/decrypted
const user = await userRepo.insert({
  name: 'John Doe',
  email: 'john@example.com', // Automatically encrypted
  password: 'hashed_password', // Automatically encrypted
});

// Retrieved data is automatically decrypted
const retrievedUser = await userRepo.findOne({ id: user.id });
// email and password are decrypted
```

## Security Best Practices

### Environment Variables
```bash
# Database Connection
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Encryption
DB_ENCRYPTION=true
DB_ENCRYPTION_KEY=32-character-encryption-key-here

# Security Features
DB_AUDIT_LOG=true

# Connection Pooling
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
```

### Database Permissions
```sql
-- Create restricted database user
CREATE USER openspeed_app WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openspeed_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO openspeed_app;

-- Never grant DROP, CREATE, ALTER permissions to application user
-- Use separate migration user for schema changes
```

### Backup Security
```bash
# Encrypt backups
pg_dump --compress=9 --format=custom --encrypt AES256 --encrypt-key-file=keyfile dbname > backup.dump

# Secure backup storage
# - Use encrypted storage (AWS S3 SSE, Azure Storage Encryption)
# - Implement backup rotation
# - Test backup restoration regularly
```

### Monitoring & Alerting
```typescript
// Monitor query performance
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  if (duration > 1000) { // Log slow queries
    console.warn(`Slow query: ${ctx.req.url} took ${duration}ms`);
  }
});

// Alert on security events
const logs = getQueryLogs();
const suspiciousQueries = logs.filter(log =>
  log.operation === 'RAW_QUERY' ||
  log.error?.includes('SQL injection') ||
  log.duration > 30000
);

if (suspiciousQueries.length > 0) {
  // Send alert to security team
  sendSecurityAlert(suspiciousQueries);
}
```

## Security Considerations

### Known Limitations

1. **Raw Query Warnings**: The `raw()` method bypasses security measures
2. **Memory Query Logs**: Query logs are stored in memory (use external logging in production)
3. **Encryption Key Management**: Encryption keys should be rotated regularly
4. **Backup Encryption**: Database dumps need separate encryption

### Future Enhancements

1. **Advanced Encryption**: Support for client-side encryption
2. **Query Obfuscation**: Hide sensitive data in logs
3. **Database Firewall**: Block suspicious queries at database level
4. **Automated Key Rotation**: Automatic encryption key rotation
5. **Database Activity Monitoring**: Real-time security monitoring

## API Reference

### Database Plugin Options
```typescript
interface DatabaseConfig {
  type: 'mongodb' | 'mysql' | 'postgresql' | 'redis';
  connection: string | object;
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
  };
  multiTenant?: boolean;
  tenantKey?: string;
  encryptionKey?: string;
  enableQueryLogging?: boolean;
  enableAuditLog?: boolean;
  maxQueryTime?: number;
}
```

### Security Functions
```typescript
// Get query logs
getQueryLogs(limit?: number): QueryLogEntry[];

// Clear query logs
clearQueryLogs(): void;

// Health check
healthCheck(connectionName: string): Promise<HealthStatus>;

// Get security configuration
getSecurityConfig(): SecurityConfig;
```

## Compliance

This database security implementation supports:

- **GDPR**: Data encryption and audit logging
- **PCI DSS**: Encrypted card data storage
- **HIPAA**: Protected health information encryption
- **SOX**: Financial data security and auditing

## Testing Database Security

### Unit Tests
```typescript
describe('Database Security', () => {
  it('should encrypt sensitive fields', async () => {
    const user = await userRepo.insert({
      email: 'test@example.com',
      password: 'secret123'
    });

    // Verify data is encrypted in database
    const rawData = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
    expect(rawData.rows[0].email).not.toBe('test@example.com');
  });

  it('should detect dangerous input', async () => {
    await expect(userRepo.find({ email: "'; DROP TABLE users; --" }))
      .rejects.toThrow('Potentially dangerous input');
  });
});
```

### Security Testing Tools
- **SQLMap**: Test for SQL injection vulnerabilities
- **OWASP ZAP**: Database security scanning
- **Custom Security Tests**: Input validation and encryption testing

---

**Last Updated:** October 30, 2025
**Version:** OpenSpeed v0.7.0