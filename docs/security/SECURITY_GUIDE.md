---
layout: default
title: SECURITY GUIDE
parent: Security
nav_order: 3
---

# OpenSpeed Security Guide

## 🔒 Security Best Practices

This guide provides comprehensive security recommendations for OpenSpeed applications.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Input Validation](#input-validation)
3. [SQL Injection Prevention](#sql-injection-prevention)
4. [XSS Prevention](#xss-prevention)
5. [CSRF Protection](#csrf-protection)
6. [Secure Headers](#secure-headers)
7. [File Upload Security](#file-upload-security)
8. [Session Management](#session-management)
9. [Rate Limiting](#rate-limiting)
10. [Security Testing](#security-testing)

---

## Authentication & Authorization

### Use Secure Password Hashing

❌ **Don't:**
```typescript
import { auth } from 'openspeed/plugins/auth'; // Deprecated - uses weak HMAC-SHA256

app.use(auth({ /* ... */ }));
```

✅ **Do:**
```typescript
import { hashPassword, verifyPassword } from '@openspeed/auth';

// Strong bcrypt hashing
const hash = await hashPassword('password123', 12); // 12 rounds
const isValid = await verifyPassword('password123', hash);
```

### Implement Proper Authentication

```typescript
import { jwt, requireAuth } from 'openspeed/plugins';

app.use(jwt({
  secret: process.env.JWT_SECRET!, // Use environment variables
  expiresIn: '1h',
  issuer: 'your-app',
  audience: 'your-users'
}));

// Protect routes
app.get('/profile', requireAuth(), async (ctx) => {
  const user = ctx.req.user;
  return ctx.json({ user });
});
```

---

## Input Validation

### Always Validate User Input

```typescript
import { validate } from 'openspeed/plugins';
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  name: z.string().max(100).regex(/^[a-zA-Z\s]+$/),
  age: z.number().int().min(13).max(120)
});

app.post('/register', 
  validate({ body: userSchema }),
  async (ctx) => {
    const data = ctx.req.body; // Already validated
    // ... register user
  }
);
```

### Sanitize HTML Input

```typescript
import DOMPurify from 'isomorphic-dompurify';

app.post('/comment', async (ctx) => {
  const { comment } = ctx.req.body;
  
  // Sanitize before storing
  const clean = DOMPurify.sanitize(comment, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: []
  });
  
  await db.insert({ comment: clean });
});
```

---

## SQL Injection Prevention

### Use SQL Validator

```typescript
import { validateSQL, sql } from 'openspeed/plugins';

// ❌ Vulnerable to SQL injection
const userId = ctx.req.query.id;
const query = `SELECT * FROM users WHERE id = ${userId}`; // DON'T DO THIS!

// ✅ Safe - using validator
const { query, params } = sql(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);

const users = await db.query(query, params);
```

### Parameterized Queries

```typescript
// ✅ MySQL
await connection.query(
  'SELECT * FROM users WHERE email = ? AND status = ?',
  [email, 'active']
);

// ✅ PostgreSQL
await pool.query(
  'SELECT * FROM users WHERE email = $1 AND status = $2',
  [email, 'active']
);

// ✅ MongoDB (uses objects, naturally safe)
await db.collection('users').findOne({
  email: email,
  status: 'active'
});
```

---

## XSS Prevention

### Escape Output by Default

```typescript
import { jsx, renderToString } from 'openspeed/plugins';

// ✅ Automatically escaped
const UserProfile = ({ name, bio }) => (
  <div>
    <h1>{name}</h1>  {/* Escaped automatically */}
    <p>{bio}</p>
  </div>
);

app.get('/profile/:id', async (ctx) => {
  const user = await getUser(ctx.params.id);
  const html = renderToString(<UserProfile {...user} />);
  return ctx.html(html);
});
```

### Use Raw HTML Carefully

```typescript
import { raw } from 'openspeed/plugins';

// ❌ Dangerous - XSS vulnerability
const html = raw(userInput); // NEVER do this with user input!

// ✅ Only for trusted, sanitized content
const sanitizedHTML = DOMPurify.sanitize(userInput);
const html = raw(sanitizedHTML, { trusted: true });
```

---

## CSRF Protection

### Enable CSRF Protection

```typescript
import { csrf, csrfToken, csrfInput } from 'openspeed/plugins';

app.use(csrf({
  secret: process.env.CSRF_SECRET,
  cookieName: '_csrf',
  headerName: 'x-csrf-token',
  enforceForMethods: ['POST', 'PUT', 'DELETE', 'PATCH']
}));

// In your form (JSX)
const LoginForm = ({ csrfToken }) => (
  <form method="POST" action="/login">
    <input type="hidden" name="csrf_token" value={csrfToken} />
    <input type="email" name="email" required />
    <input type="password" name="password" required />
    <button type="submit">Login</button>
  </form>
);

app.get('/login', (ctx) => {
  const token = csrfToken(ctx);
  return ctx.html(renderToString(<LoginForm csrfToken={token} />));
});
```

### AJAX Requests

```javascript
// Client-side JavaScript
const token = document.querySelector('[name=csrf_token]').value;

fetch('/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token
  },
  body: JSON.stringify({ data: 'value' })
});
```

---

## Secure Headers

### Use Security Middleware

```typescript
import { security } from 'openspeed/plugins';

app.use(security({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{random}'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Other headers
  noSniff: true,
  frameOptions: 'DENY',
  xssProtection: true,
  
  // Input validation
  sanitizeInput: true,
  maxBodySize: 1024 * 1024, // 1MB
  
  // CSRF
  csrf: {
    secret: process.env.CSRF_SECRET
  }
}));
```

---

## File Upload Security

### Validate File Uploads

```typescript
import { upload } from 'openspeed/plugins';

app.use(upload({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10
  },
  
  // Security options
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  scanForMalware: true, // Requires ClamAV
  secureFilename: true, // Generate random filenames
  
  // Rate limiting
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxUploads: 10
  }
}));

app.post('/upload', async (ctx) => {
  const files = ctx.req.files;
  
  if (!files || !files.avatar) {
    return ctx.json({ error: 'No file uploaded' }, 400);
  }
  
  const file = files.avatar[0];
  
  // Additional validation
  if (file.size > 5 * 1024 * 1024) {
    return ctx.json({ error: 'File too large' }, 400);
  }
  
  // Process file...
});
```

---

## Session Management

### Secure Cookie Configuration

```typescript
import { cookie } from 'openspeed/plugins';

app.use(cookie({
  secret: process.env.COOKIE_SECRET,
  httpOnly: true, // Prevent JavaScript access
  secure: true, // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 3600000, // 1 hour
  path: '/',
  domain: '.yourdomain.com'
}));
```

### Session Regeneration

```typescript
app.post('/login', async (ctx) => {
  const { email, password } = ctx.req.body;
  
  const user = await authenticateUser(email, password);
  
  if (user) {
    // Regenerate session ID to prevent fixation
    ctx.cookies?.delete('sessionId');
    
    const newSessionId = generateSecureToken();
    ctx.cookies?.set('sessionId', newSessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    });
    
    return ctx.json({ success: true });
  }
  
  return ctx.json({ error: 'Invalid credentials' }, 401);
});
```

---

## Rate Limiting

### Prevent Brute Force Attacks

```typescript
import { rateLimit } from 'openspeed/plugins';

// Global rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
}));

// Strict rate limiting for login
app.post('/login',
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 attempts per minute
    message: 'Too many login attempts'
  }),
  async (ctx) => {
    // ... login logic
  }
);
```

---

## Security Testing

### Run Security Scans

```bash
# Scan for vulnerabilities
npm run security:scan

# Export scan results
npm run security:scan:json

# Auto-fix common issues
npm run security:fix

# Dry run (preview fixes)
npm run security:fix:dry

# Check dependencies
npm audit

# Fix vulnerable dependencies
npm audit fix
```

### Security Test Suite

```typescript
import { describe, it, expect } from 'vitest';
import { validateSQL } from 'openspeed/plugins';

describe('Security Tests', () => {
  it('should prevent SQL injection', () => {
    expect(() => {
      validateSQL("SELECT * FROM users WHERE id = '1' OR '1'='1'");
    }).toThrow();
  });
  
  it('should allow parameterized queries', () => {
    expect(() => {
      validateSQL('SELECT * FROM users WHERE id = ?', [123]);
    }).not.toThrow();
  });
});
```

---

## Security Checklist

- [ ] Use bcrypt for password hashing (min 12 rounds)
- [ ] Validate all user inputs with schemas
- [ ] Use parameterized queries for SQL
- [ ] Enable CSRF protection for state-changing operations
- [ ] Set secure HTTP headers (CSP, HSTS, X-Frame-Options)
- [ ] Use HTTPS in production
- [ ] Implement rate limiting on authentication endpoints
- [ ] Sanitize HTML output to prevent XSS
- [ ] Validate file uploads (type, size, malware)
- [ ] Set secure cookie flags (httpOnly, secure, sameSite)
- [ ] Regenerate session IDs after login
- [ ] Keep dependencies updated (`npm audit`)
- [ ] Run security scans regularly
- [ ] Never commit secrets to version control
- [ ] Use environment variables for sensitive data
- [ ] Implement proper error handling (no sensitive info in errors)
- [ ] Enable audit logging for compliance
- [ ] Regular security testing and penetration testing

---

## Emergency Response

### If You Discover a Vulnerability

1. **Don't panic** - Most issues can be fixed quickly
2. **Assess impact** - Determine severity and affected users
3. **Apply hotfix** - Use `npm run security:fix` or patch manually
4. **Update dependencies** - Run `npm audit fix`
5. **Test thoroughly** - Ensure fix doesn't break functionality
6. **Deploy immediately** - Security fixes take priority
7. **Notify users** - If sensitive data was exposed
8. **Post-mortem** - Document what happened and how to prevent it

### Report Security Issues

If you discover a security vulnerability in OpenSpeed framework:

- **Email**: security@openspeed.dev
- **Do NOT** open public issues for security vulnerabilities
- Include detailed steps to reproduce
- We'll respond within 24 hours

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)

---

**Stay secure! 🔒**
