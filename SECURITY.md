# Security Guidelines for OpenSpeed

## Overview

This document outlines the security measures implemented in OpenSpeed and provides guidelines for secure usage.

## Security Fixes Applied

### 1. Authentication & Password Security

**Issue**: Hardcoded salt and weak password hashing in `src/openspeed/plugins/auth.ts`

**Status**: ✅ Fixed

**Changes**:
- Removed hardcoded salt `'openspeed-salt'`
- Now requires `PASSWORD_SALT` environment variable (minimum 32 characters)
- Added comprehensive deprecation warnings
- Plugin is marked as deprecated - use `packages/auth` with bcrypt for production

**Migration Required**: Yes
```bash
# Generate a secure salt
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set environment variable
export PASSWORD_SALT="your-generated-salt-here"
```

**Recommended Action**: Migrate to bcrypt-based auth from `packages/auth` package

---

### 2. CSRF Protection

**Issue**: Hardcoded default CSRF secret in `src/openspeed/plugins/security.ts`

**Status**: ✅ Fixed

**Changes**:
- Removed hardcoded default secret `'default-csrf-secret'`
- Now requires `CSRF_SECRET` environment variable (minimum 32 characters)
- Added validation and clear error messages

**Setup Required**: Yes
```bash
# Generate a secure CSRF secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set environment variable
export CSRF_SECRET="your-generated-secret-here"
```

---

### 3. Cookie Security

**Issue**: Cookie injection vulnerability in `src/openspeed/context.ts`

**Status**: ✅ Fixed

**Changes**:
- Added proper URL encoding for cookie names and values
- Added validation to prevent special character injection (`;`, `=`, `,`)
- Sanitized path and domain attributes
- Enhanced null byte protection

**Impact**: Automatic - no configuration needed

---

### 4. XSS Protection in JSX

**Issue**: Raw HTML injection without proper warnings in `src/openspeed/plugins/jsx.ts`

**Status**: ✅ Fixed

**Changes**:
- Added proper handling for raw HTML in `renderElement()`
- Added runtime console warnings when raw HTML is used
- Enhanced documentation with comprehensive security warnings
- Clear examples of safe vs. unsafe usage

**Usage**:
```typescript
// ✅ SAFE - Use normal JSX (auto-escaped)
<div>{userInput}</div>

// ⚠️ DANGEROUS - Only use with trusted content
import { raw } from 'openspeed/plugins/jsx';
const trustedHtml = raw('<div>Static trusted content</div>');

// ❌ NEVER DO THIS
const unsafe = raw(userInput); // XSS vulnerability!
```

---

### 5. SQL Injection Protection

**Issue**: Raw SQL queries without proper validation in `src/openspeed/plugins/database.ts`

**Status**: ✅ Fixed

**Changes**:
- Enhanced validation for `raw()` method
- Added parameter count verification
- Added detection of dangerous string concatenation
- Enhanced security warnings

**Best Practices**:
```typescript
// ✅ SAFE - Use query builder methods
await queryBuilder.find({ id: userId });

// ✅ SAFE - Parameterized raw query
await queryBuilder.raw('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ DANGEROUS - String concatenation
await queryBuilder.raw(`SELECT * FROM users WHERE id = '${userId}'`); // Will throw error
```

---

## Required Environment Variables

For production deployment, the following environment variables must be set:

### Critical (Production Required)
- `PASSWORD_SALT` - Salt for password hashing (min 32 chars) - Only if using deprecated auth plugin
- `CSRF_SECRET` - Secret for CSRF token generation (min 32 chars) - If using CSRF protection

### Optional (Feature-Dependent)
- `DB_ENCRYPTION_KEY` - Encryption key for sensitive database fields (32 bytes)
- `DB_AUDIT_LOG` - Enable database audit logging (`true`/`false`)
- `DB_ENCRYPTION` - Enable database field encryption (`true`/`false`)
- `REDIS_URL` - Redis connection URL (default: `redis://localhost:6379`)

### Generate Secure Secrets

```bash
# Generate a 32-byte (256-bit) secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use this one-liner for multiple secrets
for i in {1..3}; do node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; done
```

---

## Security Best Practices

### 1. Input Validation

Always validate user input using the validation plugin:

```typescript
import { validate } from 'openspeed/plugins/validate';
import { z } from 'zod';

app.post('/user', validate({
  body: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    age: z.number().min(0).max(150)
  })
}), handler);
```

### 2. CORS Configuration

Be specific with CORS origins in production:

```typescript
import { cors } from 'openspeed/plugins/cors';

// ❌ DON'T DO THIS IN PRODUCTION
app.use(cors({ origin: '*', credentials: true })); // Will throw error now

// ✅ DO THIS
app.use(cors({ 
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true 
}));
```

### 3. Security Headers

Use the security plugin with appropriate presets:

```typescript
import { security, securityPresets } from 'openspeed/plugins/security';

// Development
app.use(security(securityPresets.development));

// Production
app.use(security(securityPresets.production));

// API
app.use(security(securityPresets.api));
```

### 4. File Upload Security

Configure strict file upload validation:

```typescript
import { upload } from 'openspeed/plugins/upload';

app.use(upload({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5
  },
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  scanForMalware: true, // Requires ClamAV
  secureFilename: true,
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxUploads: 10
  }
}));
```

### 5. Database Security

- Always use parameterized queries
- Enable encryption for sensitive fields
- Enable audit logging in production
- Use connection pooling
- Implement rate limiting

```typescript
import { database } from 'openspeed/plugins/database';

app.use(database('main', {
  type: 'postgresql',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  enableQueryLogging: true,
  enableAuditLog: true,
  encryptionKey: process.env.DB_ENCRYPTION_KEY,
  maxQueryTime: 30000
}));
```

### 6. Authentication

Use bcrypt-based authentication for production:

```typescript
// ❌ DON'T USE
import { auth } from 'openspeed/plugins/auth'; // Deprecated

// ✅ USE THIS (from packages/auth)
import { createAuthHandler, hashPassword } from '@openspeed/auth';

// Hash password with bcrypt
const hashedPassword = await hashPassword(userPassword);
```

---

## CodeQL Security Scanning

This project uses CodeQL for automated security analysis. Known alerts:

1. **js/insufficient-password-hash** in `src/openspeed/plugins/auth.ts`
   - **Status**: Expected - plugin is deprecated and marked for migration
   - **Mitigation**: Environment variable requirement + comprehensive warnings
   - **Action**: Migrate to bcrypt-based auth from `packages/auth`

---

## Security Contact

If you discover a security vulnerability, please email security@openspeed.dev or open a private security advisory on GitHub.

Do not open public issues for security vulnerabilities.

---

## Security Checklist for Production

- [ ] Set all required environment variables
- [ ] Use bcrypt-based authentication (not deprecated auth plugin)
- [ ] Configure specific CORS origins (no wildcards with credentials)
- [ ] Enable CSRF protection with strong secret
- [ ] Use HTTPS/TLS in production
- [ ] Enable security headers via security plugin
- [ ] Configure file upload restrictions
- [ ] Enable database encryption for sensitive fields
- [ ] Enable audit logging
- [ ] Implement rate limiting
- [ ] Regular security updates and dependency audits
- [ ] Monitor security logs
- [ ] Run CodeQL scans regularly

---

## Regular Maintenance

1. **Dependency Updates**: Run `npm audit` regularly
2. **Security Patches**: Apply security updates promptly
3. **Review Logs**: Check audit logs for suspicious activity
4. **Rotate Secrets**: Rotate CSRF secrets and encryption keys periodically
5. **Backup**: Regular encrypted backups of sensitive data

---

Last Updated: 2025-11-03
Security Version: 1.0
