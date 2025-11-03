# Security Policy

## Overview

OpenSpeed takes security seriously. This document outlines security best practices and the recent security improvements made to the framework.

## Recent Security Fixes

### 1. Removed Hardcoded Secrets (CRITICAL)

**Issue**: The auth plugin (`src/openspeed/plugins/auth.ts`) previously used a hardcoded salt `'openspeed-salt'` for password hashing.

**Fix**: 
- Removed hardcoded salt
- Now requires `PASSWORD_HASH_SALT` environment variable
- Added validation to prevent use of default/dev secrets in production
- Added clear warnings and documentation

**Action Required**:
```bash
# Set a strong, cryptographically random salt
export PASSWORD_HASH_SALT="your-secure-random-salt-minimum-32-characters"
```

### 2. Weak Password Hashing (HIGH)

**Issue**: The auth plugin uses HMAC-SHA256 for password hashing, which is NOT designed for password storage.

**Current Status**: 
- Added comprehensive warnings in the code
- Documented the security risk
- Provided migration path to bcrypt

**Recommended Action**:
For production use, migrate to the secure auth package in `packages/auth`:

```javascript
// Instead of this (INSECURE):
import { auth } from 'openspeed/plugins/auth';

// Use this (SECURE):
import { hashPassword, verifyPassword, generateAccessToken } from '../../../packages/auth/src/index.js';

// Hash passwords with bcrypt (cost factor 12)
const hashedPassword = await hashPassword('user-password');

// Verify passwords with timing-safe comparison
const isValid = await verifyPassword('user-password', hashedPassword);
```

### 3. Timing Attacks Prevention

**Fix**: Implemented timing-safe string comparison using Node.js built-in `crypto.timingSafeEqual()` for:
- Password verification
- JWT signature validation  
- Bearer token comparison
- CSRF token validation

### 4. CSRF Token Generation

**Fix**: Updated CSRF token generation to use cryptographically secure `crypto.randomBytes(32)` instead of less secure methods.

### 5. Environment Variable Enforcement

**Fix**: Added strict validation that prevents use of default/development secrets in production:
- `JWT_SECRET` must be set and not use default values
- `PASSWORD_HASH_SALT` must be set for password hashing
- `CSRF_SECRET` should be set via environment variable
- All secrets must be at least 32 characters long in production

## Security Best Practices

### Required Environment Variables

Set these environment variables in production:

```bash
# JWT Authentication (REQUIRED)
export JWT_SECRET="your-cryptographically-random-secret-min-32-chars"
export JWT_REFRESH_SECRET="another-different-secret-min-32-chars"

# Password Hashing (if using basic auth plugin)
export PASSWORD_HASH_SALT="secure-random-salt-min-32-chars"

# CSRF Protection
export CSRF_SECRET="another-secure-random-secret"

# Database Encryption (if using database features)
export DB_ENCRYPTION_KEY="database-encryption-key-min-32-chars"
```

### Generate Secure Secrets

Use these commands to generate cryptographically secure secrets:

```bash
# Generate a 64-character hex secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use openssl
openssl rand -hex 32
```

### Recommended Security Stack

For production applications, we recommend:

1. **Authentication**: Use `packages/auth` with bcrypt password hashing
2. **Rate Limiting**: Enable the rate limiting plugin
3. **CORS**: Configure CORS properly for your domain
4. **Helmet**: Use security headers via the security plugin
5. **HTTPS**: Always use HTTPS in production
6. **Environment Variables**: Never commit secrets to git

### Security Plugin Configuration

```javascript
import { security, securityPresets } from 'openspeed/plugins/security';

// Use production preset
app.use(security(securityPresets.production));

// Or customize
app.use(security({
  contentSecurityPolicy: "default-src 'self'; script-src 'self'",
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  csrf: { secret: process.env.CSRF_SECRET },
  sanitizeInput: true,
  maxBodySize: 1024 * 1024, // 1MB
}));
```

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please email the maintainers directly at:
- security@openspeed.dev (if available)
- Or open a private security advisory on GitHub

**Please do not open public issues for security vulnerabilities.**

## Security Checklist for Deployment

- [ ] All environment variables are set with strong, random values
- [ ] No default/development secrets are being used
- [ ] Using bcrypt for password hashing (via `packages/auth`)
- [ ] HTTPS is enabled
- [ ] Rate limiting is configured
- [ ] CORS is properly configured
- [ ] Security headers are enabled
- [ ] Error messages don't expose sensitive information (`exposeStack: false`)
- [ ] Input validation is enabled
- [ ] Database connections use encryption
- [ ] Secrets are managed via environment variables or secret management service

## Compliance

The security improvements help with:
- **OWASP Top 10** compliance
- **GDPR** requirements for data protection
- **PCI DSS** requirements for secure authentication
- **SOC 2** audit requirements
- **HIPAA** security standards

## Updates and Maintenance

- Security patches are released as soon as possible
- Subscribe to GitHub security advisories for notifications
- Regularly update to the latest version
- Review CHANGELOG.md for security-related updates

## Version History

- **v0.8.1** (Current): Security hardening update
  - Removed hardcoded secrets
  - Added timing-safe comparisons
  - Improved CSRF token generation
  - Enhanced environment variable validation
  - Added comprehensive security warnings

## Additional Resources

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [OpenSpeed Documentation](./docs/)
