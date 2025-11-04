// Migration example for existing authentication code

// ❌ BEFORE (Deprecated - DO NOT USE)
import { auth, hashPassword } from 'openspeed/plugins/auth';

// ✅ AFTER (Secure)
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  validateSecrets,
} from '@openspeed/auth';

// 1. Update imports
// Remove: import { auth } from 'openspeed/plugins/auth';
// Add: import { hashPassword, verifyPassword } from '@openspeed/auth';

// 2. Update password hashing
// ❌ OLD
const hashedPassword = hashPassword(password); // Uses weak HMAC-SHA256

// ✅ NEW
const hashedPassword = await hashPassword(password); // Uses bcrypt

// 3. Update password verification
// ❌ OLD
if (storedHash === hashPassword(inputPassword)) {
  // Authenticate
}

// ✅ NEW
if (await verifyPassword(inputPassword, storedHash)) {
  // Authenticate
}

// 4. Update JWT token generation
// ❌ OLD - No secure token generation in deprecated plugin
// ✅ NEW
import { generateAccessToken, generateRefreshToken } from '@openspeed/auth';

const accessToken = generateAccessToken({ userId: '123', email: 'user@example.com' });
const refreshToken = generateRefreshToken({ userId: '123', email: 'user@example.com' });

// 5. Add secrets validation
const secretsStatus = validateSecrets();
if (!secretsStatus.valid) {
  console.error('Security issues with secrets:', secretsStatus.errors);
}

// 6. Add rate limiting and account lockout
import { checkRateLimit, recordFailedAttempt, recordSuccessfulLogin } from '@openspeed/auth';

const rateLimitResult = await checkRateLimit(userId);
if (!rateLimitResult.allowed) {
  return { error: 'Too many attempts', retryAfter: rateLimitResult.resetTime };
}

// On failed login
await recordFailedAttempt(userId);

// On successful login
await recordSuccessfulLogin(userId);

// 7. Update middleware usage
// ❌ OLD
app.use(
  auth({
    jwt: { secret: 'example-jwt-value' },
    basic: { users: { admin: hashPassword('password') } },
  })
);

// ✅ NEW
app.use(
  auth({
    jwt: { secret: process.env.JWT_SECRET },
    basic: { users: { admin: await hashPassword('password') } },
  })
);

// 8. For gradual migration (rehash on login)
export async function authenticateUser(email: string, password: string) {
  const user = await getUserByEmail(email);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  let isValid = false;

  // Check if using legacy hash (for migration period)
  if (user.passwordHash.startsWith(user.passwordHash.slice(0, 4))) {
    // Assume legacy hashes are hex strings of specific length
    isValid = verifyLegacyPassword(password, user.passwordHash);

    if (isValid) {
      // Rehash with secure method
      const newHash = await hashPassword(password);
      await updateUserPasswordHash(user.id, newHash);
      console.log(`User ${user.id} password rehashed with bcrypt`);
    }
  } else {
    // Already using secure hash
    isValid = await verifyPassword(password, user.passwordHash);
  }

  if (isValid) {
    // Generate tokens, etc.
    return { success: true, user };
  }

  return { success: false, error: 'Invalid credentials' };
}
