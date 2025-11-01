import type { Context } from '../context.js';

type Middleware = (ctx: Context, next: () => Promise<any>) => any;

interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[];
  priority?: number;
}

interface User {
  id: string;
  roles: string[];
  permissions?: Permission[];
  metadata?: Record<string, any>;
}

interface RBACConfig {
  roles: Map<string, Role>;
  getUserRoles: (ctx: Context) => Promise<string[]> | string[];
  getUserPermissions?: (ctx: Context) => Promise<Permission[]> | Permission[];
  cache?: boolean;
  cacheTTL?: number;
  onUnauthorized?: (ctx: Context, resource: string, action: string) => void;
  superAdminRole?: string;
}

interface AccessControl {
  allow: (resource: string, actions: string | string[]) => AccessControl;
  deny: (resource: string, actions: string | string[]) => AccessControl;
  when: (condition: (ctx: Context) => boolean | Promise<boolean>) => AccessControl;
  check: (ctx: Context) => Promise<boolean>;
}

/**
 * Advanced RBAC (Role-Based Access Control) Plugin
 * 
 * Features:
 * - Hierarchical role inheritance
 * - Fine-grained permissions with conditions
 * - Dynamic permission evaluation
 * - Permission caching for performance
 * - Resource-based access control
 * - Action-level authorization
 * - Wildcard support for resources and actions
 * - Audit logging integration
 */
export function rbac(config: RBACConfig): Middleware {
  const permissionCache = new Map<string, { permissions: Permission[]; timestamp: number }>();
  const cacheTTL = config.cacheTTL || 300000; // 5 minutes default

  return async (ctx: Context, next: () => Promise<any>) => {
    // Add RBAC methods to context
    (ctx as any).can = createCanMethod(ctx, config, permissionCache, cacheTTL);
    (ctx as any).cannot = createCannotMethod(ctx, config, permissionCache, cacheTTL);
    (ctx as any).authorize = createAuthorizeMethod(ctx, config, permissionCache, cacheTTL);
    (ctx as any).hasRole = createHasRoleMethod(ctx, config);
    (ctx as any).hasAnyRole = createHasAnyRoleMethod(ctx, config);
    (ctx as any).hasAllRoles = createHasAllRolesMethod(ctx, config);

    await next();
  };
}

/**
 * Create 'can' method for permission checking
 */
function createCanMethod(
  ctx: Context,
  config: RBACConfig,
  cache: Map<string, any>,
  cacheTTL: number
): (resource: string, action: string, conditions?: Record<string, any>) => Promise<boolean> {
  return async (resource: string, action: string, conditions?: Record<string, any>): Promise<boolean> => {
    const userPermissions = await getUserPermissions(ctx, config, cache, cacheTTL);

    // Check super admin
    if (config.superAdminRole) {
      const userRoles = await config.getUserRoles(ctx);
      if (userRoles.includes(config.superAdminRole)) {
        return true;
      }
    }

    // Check permissions
    for (const permission of userPermissions) {
      if (matchResource(permission.resource, resource)) {
        if (matchAction(permission.actions, action)) {
          if (matchConditions(permission.conditions, conditions)) {
            return true;
          }
        }
      }
    }

    return false;
  };
}

/**
 * Create 'cannot' method (inverse of can)
 */
function createCannotMethod(
  ctx: Context,
  config: RBACConfig,
  cache: Map<string, any>,
  cacheTTL: number
): (resource: string, action: string, conditions?: Record<string, any>) => Promise<boolean> {
  const can = createCanMethod(ctx, config, cache, cacheTTL);
  return async (resource: string, action: string, conditions?: Record<string, any>): Promise<boolean> => {
    return !(await can(resource, action, conditions));
  };
}

/**
 * Create 'authorize' method that throws error if unauthorized
 */
function createAuthorizeMethod(
  ctx: Context,
  config: RBACConfig,
  cache: Map<string, any>,
  cacheTTL: number
): (resource: string, action: string, conditions?: Record<string, any>) => Promise<void> {
  const can = createCanMethod(ctx, config, cache, cacheTTL);
  return async (resource: string, action: string, conditions?: Record<string, any>): Promise<void> => {
    const allowed = await can(resource, action, conditions);
    if (!allowed) {
      if (config.onUnauthorized) {
        config.onUnauthorized(ctx, resource, action);
      } else {
        ctx.res.status = 403;
        ctx.res.body = JSON.stringify({
          error: 'Forbidden',
          message: `Access denied to ${action} on ${resource}`,
        });
        throw new Error('Forbidden');
      }
    }
  };
}

/**
 * Create 'hasRole' method
 */
function createHasRoleMethod(
  ctx: Context,
  config: RBACConfig
): (role: string) => Promise<boolean> {
  return async (role: string): Promise<boolean> => {
    const userRoles = await config.getUserRoles(ctx);
    return userRoles.includes(role);
  };
}

/**
 * Create 'hasAnyRole' method
 */
function createHasAnyRoleMethod(
  ctx: Context,
  config: RBACConfig
): (roles: string[]) => Promise<boolean> {
  return async (roles: string[]): Promise<boolean> => {
    const userRoles = await config.getUserRoles(ctx);
    return roles.some((role) => userRoles.includes(role));
  };
}

/**
 * Create 'hasAllRoles' method
 */
function createHasAllRolesMethod(
  ctx: Context,
  config: RBACConfig
): (roles: string[]) => Promise<boolean> {
  return async (roles: string[]): Promise<boolean> => {
    const userRoles = await config.getUserRoles(ctx);
    return roles.every((role) => userRoles.includes(role));
  };
}

/**
 * Get user permissions with caching
 */
async function getUserPermissions(
  ctx: Context,
  config: RBACConfig,
  cache: Map<string, any>,
  cacheTTL: number
): Promise<Permission[]> {
  // Generate cache key
  const userRoles = await config.getUserRoles(ctx);
  const cacheKey = userRoles.sort().join(',');

  // Check cache
  if (config.cache !== false) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.permissions;
    }
  }

  // Collect permissions from roles
  const permissions: Permission[] = [];
  const processedRoles = new Set<string>();

  const processRole = (roleName: string) => {
    if (processedRoles.has(roleName)) return;
    processedRoles.add(roleName);

    const role = config.roles.get(roleName);
    if (!role) return;

    // Add role permissions
    permissions.push(...role.permissions);

    // Process inherited roles
    if (role.inherits) {
      for (const inheritedRole of role.inherits) {
        processRole(inheritedRole);
      }
    }
  };

  // Process all user roles
  for (const roleName of userRoles) {
    processRole(roleName);
  }

  // Add user-specific permissions if provided
  if (config.getUserPermissions) {
    const userPermissions = await config.getUserPermissions(ctx);
    permissions.push(...userPermissions);
  }

  // Cache permissions
  if (config.cache !== false) {
    cache.set(cacheKey, { permissions, timestamp: Date.now() });
  }

  return permissions;
}

/**
 * Match resource pattern (supports wildcards)
 */
function matchResource(pattern: string, resource: string): boolean {
  if (pattern === '*') return true;
  if (pattern === resource) return true;

  // Convert pattern to regex
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return regex.test(resource);
}

/**
 * Match action (supports wildcards and arrays)
 */
function matchAction(allowedActions: string[], action: string): boolean {
  if (allowedActions.includes('*')) return true;
  if (allowedActions.includes(action)) return true;

  // Check wildcard patterns
  for (const allowedAction of allowedActions) {
    const regex = new RegExp('^' + allowedAction.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    if (regex.test(action)) return true;
  }

  return false;
}

/**
 * Match conditions
 */
function matchConditions(
  permissionConditions?: Record<string, any>,
  requestConditions?: Record<string, any>
): boolean {
  if (!permissionConditions) return true;
  if (!requestConditions) return false;

  for (const [key, value] of Object.entries(permissionConditions)) {
    if (requestConditions[key] !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Require specific permission middleware
 */
export function requirePermission(
  resource: string,
  action: string,
  conditions?: Record<string, any>
): Middleware {
  return async (ctx: Context, next: () => Promise<any>) => {
    const authorize = (ctx as any).authorize;
    if (!authorize) {
      throw new Error('RBAC plugin must be installed before using requirePermission');
    }

    await authorize(resource, action, conditions);
    await next();
  };
}

/**
 * Require specific role middleware
 */
export function requireRole(role: string | string[]): Middleware {
  const roles = Array.isArray(role) ? role : [role];

  return async (ctx: Context, next: () => Promise<any>) => {
    const hasAnyRole = (ctx as any).hasAnyRole;
    if (!hasAnyRole) {
      throw new Error('RBAC plugin must be installed before using requireRole');
    }

    const hasRole = await hasAnyRole(roles);
    if (!hasRole) {
      ctx.res.status = 403;
      ctx.res.body = JSON.stringify({
        error: 'Forbidden',
        message: `Required role(s): ${roles.join(', ')}`,
      });
      return;
    }

    await next();
  };
}

/**
 * Role builder utility
 */
export class RoleBuilder {
  private roles = new Map<string, Role>();

  defineRole(name: string): RoleDefinition {
    return new RoleDefinition(name, this.roles);
  }

  build(): Map<string, Role> {
    return this.roles;
  }
}

class RoleDefinition {
  private role: Role;

  constructor(
    name: string,
    private roles: Map<string, Role>
  ) {
    this.role = { name, permissions: [] };
  }

  inherits(...roleNames: string[]): this {
    this.role.inherits = roleNames;
    return this;
  }

  can(resource: string, actions: string | string[]): this {
    const actionArray = Array.isArray(actions) ? actions : [actions];
    this.role.permissions.push({ resource, actions: actionArray });
    return this;
  }

  canWhen(resource: string, actions: string | string[], conditions: Record<string, any>): this {
    const actionArray = Array.isArray(actions) ? actions : [actions];
    this.role.permissions.push({ resource, actions: actionArray, conditions });
    return this;
  }

  priority(priority: number): this {
    this.role.priority = priority;
    return this;
  }

  build(): RoleBuilder {
    this.roles.set(this.role.name, this.role);
    return new RoleBuilder();
  }
}

// Export types
export { type Permission, type Role, type User, type RBACConfig, type AccessControl };
