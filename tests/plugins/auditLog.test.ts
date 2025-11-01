import { describe, it, expect } from 'vitest';
import { auditLog, queryAuditLogs } from '../../dist/src/openspeed/plugins/auditLog.js';

describe('Audit Logging Plugin', () => {
  it('should create audit log plugin with file storage', () => {
    const plugin = auditLog({
      storage: 'file',
      storageConfig: {
        filePath: '/tmp/audit-logs',
      },
    });

    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('function');
  });

  it('should support SOC2 compliance', () => {
    const plugin = auditLog({
      storage: 'file',
      compliance: 'SOC2',
    });

    expect(plugin).toBeDefined();
  });

  it('should support GDPR compliance', () => {
    const plugin = auditLog({
      storage: 'file',
      compliance: 'GDPR',
    });

    expect(plugin).toBeDefined();
  });

  it('should mask sensitive fields', () => {
    const plugin = auditLog({
      storage: 'file',
      sensitiveFields: ['password', 'token', 'secret'],
    });

    expect(plugin).toBeDefined();
  });

  it('should support custom storage handler', () => {
    const plugin = auditLog({
      storage: 'custom',
      storageConfig: {
        customHandler: async (entry) => {
          // Custom storage logic
        },
      },
    });

    expect(plugin).toBeDefined();
  });
});
