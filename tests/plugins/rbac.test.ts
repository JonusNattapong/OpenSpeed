import { describe, it, expect } from 'vitest';
import { rbac, requirePermission, requireRole, RoleBuilder } from '../../dist/src/openspeed/plugins/rbac.js';

describe('RBAC Plugin', () => {
  it('should create RBAC plugin', () => {
    const roles = new Map();
    roles.set('admin', {
      name: 'admin',
      permissions: [{ resource: '*', actions: ['*'] }],
    });

    const rbacPlugin = rbac({
      roles,
      getUserRoles: async () => ['admin'],
    });

    expect(rbacPlugin).toBeDefined();
    expect(typeof rbacPlugin).toBe('function');
  });

  it('should build roles with RoleBuilder', () => {
    const builder = new RoleBuilder();
    builder.defineRole('admin').can('*', '*').build();

    expect(builder).toBeDefined();
    expect(builder.build().size).toBeGreaterThan(0);
  });

  it('should support role inheritance', () => {
    const builder = new RoleBuilder();
    builder.defineRole('user').can('posts', 'read').build();
    builder.defineRole('admin').inherits('user').can('*', '*').build();

    const roles = builder.build();
    expect(roles.get('admin')?.inherits).toContain('user');
  });

  it('should create requirePermission middleware', () => {
    const middleware = requirePermission('posts', 'read');
    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');
  });

  it('should create requireRole middleware', () => {
    const middleware = requireRole('admin');
    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');
  });
});
