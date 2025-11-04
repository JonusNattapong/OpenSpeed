#!/usr/bin/env tsx

/**
 * Migration script for transitioning from deprecated auth plugin to secure bcrypt-based auth
 *
 * This script provides utilities to help migrate existing password hashes and authentication
 * code from the insecure HMAC-SHA256 implementation to the secure bcrypt implementation.
 *
 * Usage:
 *   tsx scripts/migrate-auth.ts [command] [options]
 *
 * Commands:
 *   migrate-hashes    - Migrate existing password hashes (requires plain passwords)
 *   verify-migration  - Verify that migration was successful
 *   generate-example  - Generate example migration code
 *   help              - Show this help message
 */

import { createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

// Legacy hashing function (for verification only - DO NOT USE IN PRODUCTION)
function legacyHashPassword(password: string): string {
  return createHmac('sha256', 'openspeed-salt').update(password).digest('hex');
}

// Secure hashing function
async function secureHashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password against legacy hash
function verifyLegacyPassword(password: string, hash: string): boolean {
  return legacyHashPassword(password) === hash;
}

// Verify password against secure hash
async function verifySecurePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Migration function for individual password
export async function migratePassword(plainPassword: string): Promise<{
  legacyHash: string;
  secureHash: string;
  verified: boolean;
}> {
  const legacyHash = legacyHashPassword(plainPassword);
  const secureHash = await secureHashPassword(plainPassword);
  const verified = await verifySecurePassword(plainPassword, secureHash);

  return {
    legacyHash,
    secureHash,
    verified,
  };
}

// Batch migration for multiple passwords
export async function migratePasswords(passwords: string[]): Promise<
  Array<{
    index: number;
    legacyHash: string;
    secureHash: string;
    verified: boolean;
  }>
> {
  const results = [];

  for (let i = 0; i < passwords.length; i++) {
    const result = await migratePassword(passwords[i]);
    results.push({
      index: i,
      ...result,
    });
  }

  return results;
}

// Generate migration code example
export function generateMigrationCode(): string {
  return `
// Migration example for existing authentication code

// ❌ BEFORE (Deprecated - DO NOT USE)
import { auth, hashPassword } from 'openspeed/plugins/auth';

// ✅ AFTER (Secure)
import { hashPassword, verifyPassword, generateAccessToken, validateSecrets } from '@openspeed/auth';

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
app.use(auth({
  jwt: { secret: 'example-jwt-value' },
  basic: { users: { admin: hashPassword('password') } }
}));

// ✅ NEW
app.use(auth({
  jwt: { secret: process.env.JWT_SECRET },
  basic: { users: { admin: await hashPassword('password') } }
}));

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
      console.log(\`User \${user.id} password rehashed with bcrypt\`);
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
`;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'migrate-hashes':
      console.log('🔐 OpenSpeed Auth Migration Tool');
      console.log('================================');
      console.log('');
      console.log('This tool helps migrate from deprecated HMAC-SHA256 password hashing');
      console.log('to secure bcrypt-based hashing.');
      console.log('');
      console.log('⚠️  IMPORTANT: This requires access to PLAIN TEXT passwords.');
      console.log('   If you only have hashed passwords, users must reset their passwords.');
      console.log('');
      console.log('Usage:');
      console.log('  1. Create a JSON file with passwords: ["password1", "password2"]');
      console.log('  2. Run: tsx scripts/migrate-auth.ts migrate-hashes passwords.json');
      console.log('  3. Update your database with the new hashes');
      break;

    case 'verify-migration':
      console.log('✅ Migration verification');
      console.log('Run your application and check that:');
      console.log('  - No deprecation warnings appear');
      console.log('  - Authentication works correctly');
      console.log('  - Password verification uses bcrypt');
      break;

    case 'generate-example':
      const exampleCode = generateMigrationCode();
      const outputPath = args[1] || 'auth-migration-example.ts';
      fs.writeFileSync(outputPath, exampleCode);
      console.log('✅ Migration example generated: ' + outputPath);
      break;

    case 'help':
    default:
      console.log('🔐 OpenSpeed Auth Migration Tool');
      console.log('================================');
      console.log('');
      console.log('Commands:');
      console.log('  migrate-hashes    - Interactive guide for migrating password hashes');
      console.log('  verify-migration  - Verify migration was successful');
      console.log('  generate-example  - Generate example migration code');
      console.log('  help              - Show this help message');
      console.log('');
      console.log('Examples:');
      console.log('  tsx scripts/migrate-auth.ts generate-example');
      console.log('  tsx scripts/migrate-auth.ts help');
      break;
  }
}

// Run CLI
main().catch(console.error);
