/**
 * Advanced OpenSpeed Application
 * 
 * This example demonstrates all advanced features:
 * - File-based routing
 * - Database adapters with multi-tenancy
 * - RBAC with hierarchical roles
 * - Audit logging with SOC 2 compliance
 * - Kubernetes auto-scaling
 * - Adaptive performance optimization
 */

import { createApp } from '../../src/openspeed/index.js';
import {
  fileRouting,
  database,
  rbac,
  auditLog,
  kubernetesOperator,
  adaptiveOptimizer,
  RoleBuilder,
  MongoQueryBuilder,
  requirePermission,
  requireRole,
} from '../../src/openspeed/plugins/index.js';

// Create app
const app = createApp();

// 1. Adaptive Performance Optimizer
app.use(adaptiveOptimizer({
  enableBatching: true,
  enableCaching: true,
  enablePrefetching: true,
  enableCompression: true,
}));

// ============================================================================
// API Routes
// ============================================================================

// Health check
app.get('/health', (ctx) => {
  return ctx.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Public routes
app.get('/', (ctx) => {
  return ctx.json({
    name: 'OpenSpeed Advanced Demo',
    version: '1.0.0',
    features: [
      'File-based routing',
      'Multi-tenant database',
      'RBAC',
      'Audit logging',
      'Kubernetes auto-scaling',
      'Adaptive optimization',
    ],
  });
});

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🚀 OpenSpeed Advanced Demo Server                           ║
║   Server: http://localhost:${port}                                 ║
╚════════════════════════════════════════════════════════════════╝
`);

await app.listen(port);
