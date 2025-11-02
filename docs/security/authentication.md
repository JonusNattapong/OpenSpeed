# OpenSpeed Authentication Security Guide

## Overview

This document outlines the security measures implemented in OpenSpeed's authentication system to protect against common vulnerabilities and attacks.

## Security Features

### 1. Password Security

#### Password Requirements
- Minimum 8 characters
- Must contain at least one uppercase letter
- Must contain at least one lowercase letter
- Must contain at least one number
- Must contain at least one special character (@$!%*?&)

#### Password Hashing
- Uses bcrypt with salt rounds of 12
- Timing-safe password verification
- No plain text password storage

### 2. Rate Limiting & Account Protection

#### Rate Limiting
- **Registration**: 10 requests per 15 minutes per IP
- **Login**: 10 requests per 15 minutes per IP
- **Password Reset**: 10 requests per 15 minutes per IP

#### Account Lockout
- Account locked after 5 consecutive failed login attempts
- Lockout duration: 15 minutes
- Lockout applies per email address

### 3. Timing Attack Protection

#### Login Endpoint
- Uses timing-safe password verification
- Always performs password hash comparison even when user doesn't exist
- Consistent response times to prevent user enumeration

#### Password Reset
- Always returns success message to prevent email enumeration
- Rate limiting prevents brute force attacks

### 4. JWT Token Security

#### Access Tokens
- Short expiration: 15 minutes
- Contains user ID and email only
- HMAC-SHA256 signature verification

#### Refresh Tokens
- Longer expiration: 7 days
- Used to obtain new access tokens
- Should be stored securely by client

#### Token Validation
- Signature verification on every request
- Expiration time validation
- User existence verification on refresh

### 5. Audit Logging

All authentication events are logged with:
- Timestamp
- Client IP address
- User agent
- Event type and details

#### Logged Events
- User registration
- Login attempts (success/failure)
- Password changes
- Token refresh
- Account lockouts
- Rate limit violations

### 6. Input Validation

#### Registration
```typescript
const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
});
```

#### Login
```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
```

### 7. Session Management

#### Token Refresh
- POST `/auth/refresh` with refresh token
- Returns new access and refresh tokens
- Validates user still exists

#### Logout
- POST `/auth/logout` (requires authentication)
- Client should discard tokens
- Server-side: tokens become invalid

### 8. Email Verification (Planned)

#### Send Verification Email
- POST `/auth/send-verification` (requires authentication)
- Generates secure verification token
- Token expires in 24 hours

#### Verify Email
- POST `/auth/verify-email` with token
- Marks email as verified
- Prevents token reuse

### 9. Password Management

#### Change Password
- POST `/auth/change-password` (requires authentication)
- Validates current password
- Enforces new password requirements
- Logs password changes

#### Forgot Password
- POST `/auth/forgot-password`
- Rate limited to prevent abuse
- Sends reset link (not implemented yet)
- Always returns success to prevent enumeration

## Security Best Practices

### For Developers

#### Environment Variables
```bash
# Required
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
CSRF_SECRET=your-csrf-secret-key

# Database
DATABASE_URL=your-database-connection-string

# Email (for verification)
SMTP_HOST=your-smtp-host
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

#### Client-Side Security
```javascript
// Store tokens securely
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Use HTTPS only
// Implement token refresh logic
// Clear tokens on logout
```

### For Production Deployment

#### Use HTTPS
- All authentication endpoints must use HTTPS
- Set `secure` flag on cookies
- Use `httpOnly` for sensitive cookies

#### Database Security
- Use parameterized queries (already implemented)
- Encrypt sensitive data at rest
- Regular security audits

#### Monitoring
- Monitor authentication logs
- Set up alerts for suspicious activity
- Regular security reviews

## API Endpoints

### Public Endpoints

#### POST `/auth/register`
Register a new user account.

**Security Features:**
- Rate limiting
- Input validation
- Password strength requirements
- Audit logging

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "email": "john@example.com",
    "name": "John Doe"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

#### POST `/auth/login`
Authenticate user credentials.

**Security Features:**
- Rate limiting
- Account lockout protection
- Timing attack prevention
- Audit logging

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

#### POST `/auth/forgot-password`
Request password reset.

**Security Features:**
- Rate limiting
- Prevents email enumeration

### Protected Endpoints

#### POST `/auth/refresh`
Refresh access token.

**Headers:**
```
Authorization: Bearer <refresh-token>
```

#### POST `/auth/logout`
Logout user.

**Headers:**
```
Authorization: Bearer <access-token>
```

#### POST `/auth/change-password`
Change user password.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "currentPassword": "CurrentPass123!",
  "newPassword": "NewSecurePass456!"
}
```

#### GET `/users/me`
Get current user profile.

**Headers:**
```
Authorization: Bearer <access-token>
```

## Security Considerations

### Known Limitations

1. **In-Memory Rate Limiting**: Current implementation uses in-memory storage. For production, use Redis or database.

2. **Email Verification**: Not fully implemented. Requires email service integration.

3. **Password Reset**: Not fully implemented. Requires secure token storage and email service.

4. **Session Management**: No server-side session invalidation. Tokens remain valid until expiration.

5. **Multi-Factor Authentication**: Not implemented yet.

### Future Enhancements

1. **OAuth 2.0 Integration**: Support for Google, GitHub, etc.
2. **Multi-Factor Authentication**: TOTP, SMS, Email
3. **Advanced Rate Limiting**: Per-user and per-IP with Redis
4. **Session Management**: Server-side session storage
5. **Audit Log Storage**: Database storage for audit logs
6. **Brute Force Protection**: Advanced detection algorithms

## Testing Security

### Unit Tests
```bash
pnpm test -- tests/plugins/auth.test.ts
```

### Integration Tests
```bash
# Test rate limiting
# Test account lockout
# Test timing attack prevention
```

### Security Testing Tools
- OWASP ZAP for API testing
- Postman for endpoint testing
- Custom security test scripts

## Compliance

This authentication system is designed to meet common security standards:

- **OWASP Top 10** protection
- **GDPR** compliance for user data
- **Password policies** following NIST guidelines
- **Audit logging** for compliance requirements

## Support

For security-related issues or questions:
- Check audit logs for suspicious activity
- Review rate limiting and lockout status
- Monitor authentication failure patterns
- Regular security updates and patches

---

**Last Updated:** October 30, 2025
**Version:** OpenSpeed v0.7.0
```
