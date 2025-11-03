# Security Migration Guide

This guide helps you migrate from the insecure auth plugin to the secure auth package.

## Why Migrate?

The basic auth plugin (`src/openspeed/plugins/auth.ts`) uses HMAC-SHA256 for password hashing, which is **not suitable for production use**. Password hashing requires specialized algorithms designed to be intentionally slow and resistant to brute-force attacks.

The secure auth package (`packages/auth`) provides:
- ✅ Bcrypt password hashing (industry standard)
- ✅ Automatic salt generation
- ✅ Key rotation support
- ✅ Rate limiting and account lockout
- ✅ Timing-safe comparisons
- ✅ Redis-backed session storage (with in-memory fallback)

## Migration Steps

### Step 1: Install Dependencies

The dependencies are already included in the project, but verify they're installed:

```bash
npm install bcryptjs jsonwebtoken ioredis
```

### Step 2: Update Environment Variables

Add these to your `.env` file:

```bash
# Required
JWT_SECRET="your-cryptographically-random-secret-at-least-32-chars"
JWT_REFRESH_SECRET="another-different-secret-at-least-32-chars"

# Optional but recommended
REDIS_URL="redis://localhost:6379"
DB_ENCRYPTION_KEY="database-encryption-key-min-32-chars"
CSRF_SECRET="csrf-secret-min-32-chars"
```

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Update Your Code

#### Before (Insecure):

```javascript
import { auth } from 'openspeed/plugins/auth';
import { createHmac } from 'crypto';

// Manual password hashing (INSECURE)
const hashedPassword = createHmac('sha256', 'openspeed-salt')
  .update(password)
  .digest('hex');

// Auth middleware
app.use(auth({
  basic: {
    users: {
      'admin': hashedPassword
    }
  },
  jwt: {
    secret: 'my-secret'
  }
}));
```

#### After (Secure):

```javascript
import { 
  hashPassword, 
  verifyPassword, 
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulLogin
} from '../../../packages/auth/src/index.js';

// Hash password with bcrypt (async)
const hashedPassword = await hashPassword('user-password');

// Login route with rate limiting
app.post('/login', async (ctx) => {
  const { username, password } = ctx.getBody();
  
  // Check rate limit
  const rateLimit = await checkRateLimit(username);
  if (!rateLimit.allowed) {
    return ctx.json({ 
      error: 'Too many attempts', 
      resetTime: rateLimit.resetTime 
    }, 429);
  }
  
  // Get user from database
  const user = await db.users.findOne({ username });
  
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await recordFailedAttempt(username);
    return ctx.json({ error: 'Invalid credentials' }, 401);
  }
  
  // Record successful login
  await recordSuccessfulLogin(username);
  
  // Generate tokens
  const accessToken = generateAccessToken({ 
    userId: user.id, 
    email: user.email 
  });
  const refreshToken = generateRefreshToken({ 
    userId: user.id, 
    email: user.email 
  });
  
  return ctx.json({ accessToken, refreshToken });
});

// Protected route
app.get('/profile', async (ctx) => {
  const token = ctx.req.headers.authorization?.slice(7); // Remove 'Bearer '
  
  const payload = verifyAccessToken(token);
  if (!payload) {
    return ctx.json({ error: 'Invalid token' }, 401);
  }
  
  // Get user data
  const user = await db.users.findOne({ id: payload.userId });
  return ctx.json({ user });
});
```

### Step 4: Migrate Existing Password Hashes

If you have existing users with HMAC-SHA256 hashes, you need to migrate them:

```javascript
// Migration script
import { hashPassword } from '../../../packages/auth/src/index.js';

async function migratePasswords() {
  const users = await db.users.find({});
  
  for (const user of users) {
    // Option 1: Force password reset
    user.requirePasswordReset = true;
    await user.save();
    
    // Option 2: If you have access to plain passwords (NOT RECOMMENDED)
    // Only if you're migrating from a system where you have the plain passwords
    // const newHash = await hashPassword(user.plainPassword);
    // user.passwordHash = newHash;
    // await user.save();
  }
  
  console.log(`Migrated ${users.length} users`);
}
```

### Step 5: Update Tests

#### Before:
```javascript
const hashedPassword = require('crypto')
  .createHmac('sha256', 'openspeed-salt')
  .update('password123')
  .digest('hex');
```

#### After:
```javascript
import { hashPassword, verifyPassword } from '../../../packages/auth/src/index.js';

const hashedPassword = await hashPassword('password123');
const isValid = await verifyPassword('password123', hashedPassword);
```

### Step 6: Enable Security Features

Add additional security features from the packages/auth:

```javascript
import { 
  validateSecrets,
  rotateJWTKeys,
  autoRotateKeys,
  getLockoutStatus
} from '../../../packages/auth/src/index.js';

// Validate secrets on startup
const validation = validateSecrets();
if (!validation.valid) {
  console.error('Security validation failed:', validation.errors);
  process.exit(1);
}
if (validation.warnings.length > 0) {
  console.warn('Security warnings:', validation.warnings);
}

// Auto-rotate keys periodically (run via cron or setInterval)
setInterval(() => {
  const result = autoRotateKeys();
  if (result.jwtRotated) console.log('JWT keys rotated');
  if (result.dbRotated) console.log('DB key rotated');
  if (result.csrfRotated) console.log('CSRF secret rotated');
}, 24 * 60 * 60 * 1000); // Daily check

// Check if user is locked out before login
const lockout = await getLockoutStatus(username);
if (lockout.isLocked) {
  return ctx.json({ 
    error: 'Account locked',
    remainingTime: lockout.remainingTime 
  }, 403);
}
```

## Complete Example: User Registration and Login

```javascript
import { Openspeed } from 'openspeed';
import { 
  hashPassword, 
  verifyPassword, 
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulLogin,
  validateSecrets
} from '../../../packages/auth/src/index.js';

const app = Openspeed();

// Validate secrets on startup
const validation = validateSecrets();
if (!validation.valid) {
  console.error('Security configuration invalid:', validation.errors);
  process.exit(1);
}

// User registration
app.post('/register', async (ctx) => {
  const { username, email, password } = ctx.getBody();
  
  // Validate input
  if (!username || !email || !password) {
    return ctx.json({ error: 'Missing required fields' }, 400);
  }
  
  if (password.length < 8) {
    return ctx.json({ error: 'Password must be at least 8 characters' }, 400);
  }
  
  // Hash password with bcrypt
  const passwordHash = await hashPassword(password);
  
  // Save to database
  const user = await db.users.create({
    username,
    email,
    passwordHash,
    createdAt: new Date()
  });
  
  return ctx.json({ 
    message: 'User created successfully',
    userId: user.id 
  }, 201);
});

// User login
app.post('/login', async (ctx) => {
  const { username, password } = ctx.getBody();
  
  // Check rate limit
  const rateLimit = await checkRateLimit(username);
  if (!rateLimit.allowed) {
    return ctx.json({ 
      error: 'Too many login attempts',
      resetTime: rateLimit.resetTime 
    }, 429);
  }
  
  // Get user
  const user = await db.users.findOne({ username });
  
  // Verify password
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await recordFailedAttempt(username);
    return ctx.json({ error: 'Invalid credentials' }, 401);
  }
  
  // Record success
  await recordSuccessfulLogin(username);
  
  // Generate tokens
  const accessToken = generateAccessToken({ 
    userId: user.id, 
    email: user.email 
  });
  const refreshToken = generateRefreshToken({ 
    userId: user.id, 
    email: user.email 
  });
  
  return ctx.json({ 
    accessToken, 
    refreshToken,
    expiresIn: 900 // 15 minutes
  });
});

// Protected route
app.get('/profile', async (ctx) => {
  const authHeader = ctx.req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ctx.json({ error: 'Missing authorization header' }, 401);
  }
  
  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  
  if (!payload) {
    return ctx.json({ error: 'Invalid or expired token' }, 401);
  }
  
  // Get user data
  const user = await db.users.findOne({ id: payload.userId });
  
  if (!user) {
    return ctx.json({ error: 'User not found' }, 404);
  }
  
  return ctx.json({ 
    id: user.id,
    username: user.username,
    email: user.email 
  });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Security Checklist

After migration, verify:

- [ ] All passwords are hashed with bcrypt (cost factor 12)
- [ ] JWT secrets are loaded from environment variables
- [ ] Secrets are at least 32 characters long
- [ ] Rate limiting is enabled for login attempts
- [ ] Failed login attempts are tracked
- [ ] Account lockout is enabled after max attempts
- [ ] Timing-safe comparisons are used
- [ ] No secrets are committed to version control
- [ ] Redis is configured for session storage (optional)
- [ ] Key rotation is set up (optional but recommended)

## Troubleshooting

### Issue: "JWT_SECRET not set" error

**Solution**: Add JWT_SECRET to your environment variables:
```bash
export JWT_SECRET="your-secure-random-secret-min-32-chars"
```

### Issue: Redis connection errors

**Solution**: Redis is optional. The package falls back to in-memory storage. To fix:
```bash
# Install and start Redis
docker run -d -p 6379:6379 redis:alpine

# Or set Redis URL
export REDIS_URL="redis://localhost:6379"
```

### Issue: Bcrypt errors on some platforms

**Solution**: Rebuild bcrypt for your platform:
```bash
npm rebuild bcryptjs
```

## Need Help?

- Check the [SECURITY.md](./SECURITY.md) file
- Review the [packages/auth/src/index.ts](./packages/auth/src/index.ts) implementation
- Open an issue on GitHub
- Review OWASP password storage guidelines

## Next Steps

After migration:
1. Enable additional security features (CSRF, rate limiting, etc.)
2. Set up monitoring for failed login attempts
3. Implement key rotation schedule
4. Review and test all authentication flows
5. Update your documentation
