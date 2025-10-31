import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export { prisma };
export * from '@prisma/client';

// Database adapters
export { MongoDBAdapter } from './mongodb.js';
export { MySQLAdapter } from './mysql.js';
export { RedisCache } from './redis.js';
export { MultiTenantManager } from './multi-tenant.js';