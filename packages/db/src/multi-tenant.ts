import { PrismaClient } from '@prisma/client';
import { MongoDBAdapter } from './mongodb.js';
import { MySQLAdapter } from './mysql.js';

export interface TenantConfig {
  id: string;
  databaseUrl?: string; // For Prisma
  mongoUri?: string; // For MongoDB
  mysqlConfig?: any; // For MySQL
  schema?: string; // For PostgreSQL schema separation
}

export class MultiTenantManager {
  private tenants: Map<string, any> = new Map();
  private adapterType: 'prisma' | 'mongodb' | 'mysql';

  constructor(adapterType: 'prisma' | 'mongodb' | 'mysql' = 'prisma') {
    this.adapterType = adapterType;
  }

  async createTenant(config: TenantConfig): Promise<void> {
    switch (this.adapterType) {
      case 'prisma':
        const prisma = new PrismaClient({
          datasources: {
            db: {
              url: config.databaseUrl,
            },
          },
        });
        this.tenants.set(config.id, prisma);
        break;

      case 'mongodb':
        if (!config.mongoUri) throw new Error('MongoDB URI required');
        const mongoAdapter = new MongoDBAdapter(config.mongoUri, `tenant_${config.id}`);
        await mongoAdapter.connect();
        this.tenants.set(config.id, mongoAdapter);
        break;

      case 'mysql':
        if (!config.mysqlConfig) throw new Error('MySQL config required');
        const mysqlAdapter = new MySQLAdapter({
          ...config.mysqlConfig,
          database: `tenant_${config.id}`,
        });
        await mysqlAdapter.connect();
        this.tenants.set(config.id, mysqlAdapter);
        break;
    }
  }

  getTenant(tenantId: string): any {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    return tenant;
  }

  async removeTenant(tenantId: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      if (typeof tenant.disconnect === 'function') {
        await tenant.disconnect();
      }
      this.tenants.delete(tenantId);
    }
  }

  // Middleware for tenant context
  middleware() {
    return async (req: any, res: any, next: any) => {
      // Extract tenant from header, subdomain, etc.
      const tenantId = req.headers['x-tenant-id'] || req.subdomains[0] || 'default';

      try {
        req.tenant = this.getTenant(tenantId);
        next();
      } catch (error) {
        res.status(400).json({ error: 'Invalid tenant' });
      }
    };
  }
}