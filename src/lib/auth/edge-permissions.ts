/**
 * Edge-Optimized Permission Checking and Role Validation
 * Provides fast permission checks for edge functions with caching
 */

import { EdgeUser } from './edge-jwt';

/**
 * Permission definitions
 */
export const PERMISSIONS = {
  // System permissions
  SYSTEM_MANAGE: 'system:manage',
  SYSTEM_VIEW: 'system:view',
  
  // Admin permissions
  ADMIN_READ: 'admin:read',
  ADMIN_WRITE: 'admin:write',
  ADMIN_DELETE: 'admin:delete',
  
  // User management
  USERS_MANAGE: 'users:manage',
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_DELETE: 'users:delete',
  
  // Exam management
  EXAMS_MANAGE: 'exams:manage',
  EXAMS_CREATE: 'exams:create',
  EXAMS_EDIT: 'exams:edit',
  EXAMS_DELETE: 'exams:delete',
  EXAMS_PUBLISH: 'exams:publish',
  EXAMS_VIEW: 'exams:view',
  EXAMS_TAKE: 'exams:take',
  
  // Student management
  STUDENTS_MANAGE: 'students:manage',
  STUDENTS_VIEW: 'students:view',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_EDIT: 'students:edit',
  STUDENTS_DELETE: 'students:delete',
  
  // Results and analytics
  RESULTS_VIEW_ALL: 'results:view_all',
  RESULTS_VIEW_OWN: 'results:view_own',
  RESULTS_EXPORT: 'results:export',
  ANALYTICS_VIEW: 'analytics:view',
  
  // Audit and monitoring
  AUDIT_VIEW: 'audit:view',
  MONITORING_VIEW: 'monitoring:view',
  
  // Settings
  SETTINGS_MANAGE: 'settings:manage',
  SETTINGS_VIEW: 'settings:view'
} as const;

/**
 * Role definitions with permissions
 */
export const ROLES = {
  SUPER_ADMIN: {
    name: 'super_admin',
    displayName: 'Super Administrator',
    permissions: [
      PERMISSIONS.SYSTEM_MANAGE,
      PERMISSIONS.SYSTEM_VIEW,
      PERMISSIONS.ADMIN_READ,
      PERMISSIONS.ADMIN_WRITE,
      PERMISSIONS.ADMIN_DELETE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_DELETE,
      PERMISSIONS.EXAMS_MANAGE,
      PERMISSIONS.EXAMS_CREATE,
      PERMISSIONS.EXAMS_EDIT,
      PERMISSIONS.EXAMS_DELETE,
      PERMISSIONS.EXAMS_PUBLISH,
      PERMISSIONS.EXAMS_VIEW,
      PERMISSIONS.STUDENTS_MANAGE,
      PERMISSIONS.STUDENTS_VIEW,
      PERMISSIONS.STUDENTS_CREATE,
      PERMISSIONS.STUDENTS_EDIT,
      PERMISSIONS.STUDENTS_DELETE,
      PERMISSIONS.RESULTS_VIEW_ALL,
      PERMISSIONS.RESULTS_EXPORT,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.MONITORING_VIEW,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.SETTINGS_VIEW
    ]
  },
  ADMIN: {
    name: 'admin',
    displayName: 'Administrator',
    permissions: [
      PERMISSIONS.ADMIN_READ,
      PERMISSIONS.ADMIN_WRITE,
      PERMISSIONS.EXAMS_MANAGE,
      PERMISSIONS.EXAMS_CREATE,
      PERMISSIONS.EXAMS_EDIT,
      PERMISSIONS.EXAMS_DELETE,
      PERMISSIONS.EXAMS_PUBLISH,
      PERMISSIONS.EXAMS_VIEW,
      PERMISSIONS.STUDENTS_MANAGE,
      PERMISSIONS.STUDENTS_VIEW,
      PERMISSIONS.STUDENTS_CREATE,
      PERMISSIONS.STUDENTS_EDIT,
      PERMISSIONS.STUDENTS_DELETE,
      PERMISSIONS.RESULTS_VIEW_ALL,
      PERMISSIONS.RESULTS_EXPORT,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.SETTINGS_VIEW
    ]
  },
  MODERATOR: {
    name: 'moderator',
    displayName: 'Moderator',
    permissions: [
      PERMISSIONS.ADMIN_READ,
      PERMISSIONS.EXAMS_VIEW,
      PERMISSIONS.STUDENTS_VIEW,
      PERMISSIONS.RESULTS_VIEW_ALL,
      PERMISSIONS.ANALYTICS_VIEW
    ]
  },
  USER: {
    name: 'user',
    displayName: 'User',
    permissions: [
      PERMISSIONS.EXAMS_TAKE,
      PERMISSIONS.RESULTS_VIEW_OWN
    ]
  }
} as const;

/**
 * Permission cache for fast lookups
 */
class EdgePermissionCache {
  private static rolePermissions = new Map<string, Set<string>>();
  private static userPermissions = new Map<string, Set<string>>();
  private static initialized = false;

  /**
   * Initialize permission cache
   */
  static initialize(): void {
    if (this.initialized) return;

    // Cache role permissions
    Object.values(ROLES).forEach(role => {
      this.rolePermissions.set(role.name, new Set(role.permissions));
    });

    this.initialized = true;
  }

  /**
   * Get permissions for role
   */
  static getRolePermissions(role: string): Set<string> {
    this.initialize();
    return this.rolePermissions.get(role) || new Set();
  }

  /**
   * Cache user permissions
   */
  static cacheUserPermissions(userId: string, permissions: string[]): void {
    this.userPermissions.set(userId, new Set(permissions));
  }

  /**
   * Get cached user permissions
   */
  static getUserPermissions(userId: string): Set<string> | null {
    return this.userPermissions.get(userId) || null;
  }

  /**
   * Clear user permissions cache
   */
  static clearUserPermissions(userId?: string): void {
    if (userId) {
      this.userPermissions.delete(userId);
    } else {
      this.userPermissions.clear();
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): {
    rolePermissions: number;
    userPermissions: number;
  } {
    return {
      rolePermissions: this.rolePermissions.size,
      userPermissions: this.userPermissions.size
    };
  }
}

/**
 * Edge permission checker
 */
export class EdgePermissionChecker {
  /**
   * Check if user has specific permission
   */
  static hasPermission(user: EdgeUser, permission: string): boolean {
    EdgePermissionCache.initialize();

    // Check cached user permissions first
    const cachedPermissions = EdgePermissionCache.getUserPermissions(user.id);
    if (cachedPermissions) {
      return cachedPermissions.has(permission);
    }

    // Fall back to role-based permissions
    const rolePermissions = EdgePermissionCache.getRolePermissions(user.role);
    const hasRolePermission = rolePermissions.has(permission);

    // Cache the result
    const allPermissions = Array.from(rolePermissions);
    EdgePermissionCache.cacheUserPermissions(user.id, allPermissions);

    return hasRolePermission;
  }

  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(user: EdgeUser, permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  static hasAllPermissions(user: EdgeUser, permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  /**
   * Get all permissions for user
   */
  static getUserPermissions(user: EdgeUser): string[] {
    EdgePermissionCache.initialize();

    // Check cached permissions first
    const cachedPermissions = EdgePermissionCache.getUserPermissions(user.id);
    if (cachedPermissions) {
      return Array.from(cachedPermissions);
    }

    // Get role permissions
    const rolePermissions = EdgePermissionCache.getRolePermissions(user.role);
    const permissions = Array.from(rolePermissions);

    // Cache the result
    EdgePermissionCache.cacheUserPermissions(user.id, permissions);

    return permissions;
  }

  /**
   * Check if user is admin (has admin role)
   */
  static isAdmin(user: EdgeUser): boolean {
    return user.role === ROLES.ADMIN.name || user.role === ROLES.SUPER_ADMIN.name;
  }

  /**
   * Check if user is super admin
   */
  static isSuperAdmin(user: EdgeUser): boolean {
    return user.role === ROLES.SUPER_ADMIN.name;
  }

  /**
   * Check if user can access admin panel
   */
  static canAccessAdmin(user: EdgeUser): boolean {
    return this.hasPermission(user, PERMISSIONS.ADMIN_READ);
  }

  /**
   * Check if user can manage exams
   */
  static canManageExams(user: EdgeUser): boolean {
    return this.hasPermission(user, PERMISSIONS.EXAMS_MANAGE);
  }

  /**
   * Check if user can manage students
   */
  static canManageStudents(user: EdgeUser): boolean {
    return this.hasPermission(user, PERMISSIONS.STUDENTS_MANAGE);
  }

  /**
   * Check if user can view results
   */
  static canViewResults(user: EdgeUser): boolean {
    return this.hasAnyPermission(user, [
      PERMISSIONS.RESULTS_VIEW_ALL,
      PERMISSIONS.RESULTS_VIEW_OWN
    ]);
  }

  /**
   * Check if user can view all results (not just their own)
   */
  static canViewAllResults(user: EdgeUser): boolean {
    return this.hasPermission(user, PERMISSIONS.RESULTS_VIEW_ALL);
  }

  /**
   * Check if user can manage system settings
   */
  static canManageSettings(user: EdgeUser): boolean {
    return this.hasPermission(user, PERMISSIONS.SETTINGS_MANAGE);
  }
}

/**
 * Permission middleware factory for edge functions
 */
export function createPermissionMiddleware(
  requiredPermissions: string | string[],
  options: {
    requireAll?: boolean; // If true, user must have ALL permissions
    errorMessage?: string;
  } = {}
) {
  const permissions = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];
  
  const { requireAll = true, errorMessage } = options;

  return (user: EdgeUser): Response | null => {
    const hasPermission = requireAll
      ? EdgePermissionChecker.hasAllPermissions(user, permissions)
      : EdgePermissionChecker.hasAnyPermission(user, permissions);

    if (!hasPermission) {
      return new Response(JSON.stringify({
        error: 'Insufficient permissions',
        message: errorMessage || 'You do not have the required permissions for this action',
        required: permissions,
        user_permissions: EdgePermissionChecker.getUserPermissions(user)
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    return null; // Permission granted
  };
}

/**
 * Role-based middleware factory
 */
export function createRoleMiddleware(
  allowedRoles: string | string[],
  options: {
    errorMessage?: string;
  } = {}
) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const { errorMessage } = options;

  return (user: EdgeUser): Response | null => {
    if (!roles.includes(user.role)) {
      return new Response(JSON.stringify({
        error: 'Insufficient role',
        message: errorMessage || 'Your role does not have access to this resource',
        required_roles: roles,
        user_role: user.role
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    return null; // Role check passed
  };
}

/**
 * Admin middleware (shorthand for admin role check)
 */
export const adminMiddleware = createRoleMiddleware(
  [ROLES.ADMIN.name, ROLES.SUPER_ADMIN.name],
  { errorMessage: 'Admin access required' }
);

/**
 * Super admin middleware
 */
export const superAdminMiddleware = createRoleMiddleware(
  [ROLES.SUPER_ADMIN.name],
  { errorMessage: 'Super admin access required' }
);

/**
 * Clear permission cache (useful for testing or when permissions change)
 */
export function clearPermissionCache(userId?: string): void {
  EdgePermissionCache.clearUserPermissions(userId);
}

/**
 * Get permission cache statistics
 */
export function getPermissionCacheStats() {
  return EdgePermissionCache.getStats();
}

/**
 * Initialize permission system
 */
export function initializePermissionSystem(): void {
  EdgePermissionCache.initialize();
}