import { NextRequest } from "next/server";
import { APIRequest, APIResponse, Middleware, AuthenticatedUser } from "./unified-handler";
import { requireAdmin, getBearerToken } from "@/lib/admin";

/**
 * Admin-specific authentication and authorization middleware
 */

interface AdminUser extends AuthenticatedUser {
  is_admin: true;
}

interface AdminAuthConfig {
  permissions?: string[];
  operations?: string[];
}

/**
 * Admin permission definitions
 */
export const AdminPermissions = {
  // Exam management
  MANAGE_EXAMS: 'manage_exams',
  CREATE_EXAMS: 'create_exams',
  EDIT_EXAMS: 'edit_exams',
  DELETE_EXAMS: 'delete_exams',
  PUBLISH_EXAMS: 'publish_exams',
  
  // Student management
  MANAGE_STUDENTS: 'manage_students',
  CREATE_STUDENTS: 'create_students',
  EDIT_STUDENTS: 'edit_students',
  DELETE_STUDENTS: 'delete_students',
  BULK_OPERATIONS: 'bulk_operations',
  
  // System administration
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_MONITORING: 'view_monitoring',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  SYSTEM_CONTROL: 'system_control',
  
  // User management
  MANAGE_ADMINS: 'manage_admins',
  CREATE_ADMINS: 'create_admins',
  EDIT_ADMINS: 'edit_admins',
  DELETE_ADMINS: 'delete_admins',
  
  // Data operations
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
  BACKUP_DATA: 'backup_data',
  
  // Advanced features
  WHATSAPP_INTEGRATION: 'whatsapp_integration',
  UPLOAD_FILES: 'upload_files',
  MANAGE_UPLOADS: 'manage_uploads'
} as const;

/**
 * Admin operation definitions mapped to permissions
 */
export const AdminOperations = {
  // Dashboard operations
  'dashboard': [AdminPermissions.VIEW_MONITORING],
  
  // Exam operations
  'exams:list': [AdminPermissions.MANAGE_EXAMS],
  'exams:create': [AdminPermissions.CREATE_EXAMS],
  'exams:edit': [AdminPermissions.EDIT_EXAMS],
  'exams:delete': [AdminPermissions.DELETE_EXAMS],
  'exams:publish': [AdminPermissions.PUBLISH_EXAMS],
  'exams:duplicate': [AdminPermissions.CREATE_EXAMS],
  'exams:export': [AdminPermissions.EXPORT_DATA],
  'exams:regrade': [AdminPermissions.EDIT_EXAMS],
  
  // Student operations
  'students:list': [AdminPermissions.MANAGE_STUDENTS],
  'students:create': [AdminPermissions.CREATE_STUDENTS],
  'students:edit': [AdminPermissions.EDIT_STUDENTS],
  'students:delete': [AdminPermissions.DELETE_STUDENTS],
  'students:bulk': [AdminPermissions.BULK_OPERATIONS],
  'students:import': [AdminPermissions.IMPORT_DATA],
  'students:export': [AdminPermissions.EXPORT_DATA],
  'students:whatsapp': [AdminPermissions.WHATSAPP_INTEGRATION],
  
  // Settings operations
  'settings:view': [AdminPermissions.MANAGE_SETTINGS],
  'settings:update': [AdminPermissions.MANAGE_SETTINGS],
  
  // Monitoring operations
  'monitoring:view': [AdminPermissions.VIEW_MONITORING],
  
  // Audit operations
  'audit:view': [AdminPermissions.VIEW_AUDIT_LOGS],
  
  // Admin user operations
  'admins:list': [AdminPermissions.MANAGE_ADMINS],
  'admins:create': [AdminPermissions.CREATE_ADMINS],
  'admins:edit': [AdminPermissions.EDIT_ADMINS],
  'admins:delete': [AdminPermissions.DELETE_ADMINS],
  
  // System operations
  'system:control': [AdminPermissions.SYSTEM_CONTROL],
  'system:bootstrap': [AdminPermissions.SYSTEM_CONTROL],
  
  // Upload operations
  'upload:logo': [AdminPermissions.UPLOAD_FILES],
  'upload:question-image': [AdminPermissions.UPLOAD_FILES],
  'upload:manage': [AdminPermissions.MANAGE_UPLOADS],
  
  // Utility operations
  'whoami': [], // No special permissions needed
  'cleanup': [AdminPermissions.SYSTEM_CONTROL]
} as const;

/**
 * User context for admin operations
 */
interface AdminContext {
  user: AdminUser;
  permissions: string[];
  token: string | null;
  operation?: string;
}

/**
 * Create admin authentication middleware
 */
export function createAdminAuthMiddleware(config: AdminAuthConfig = {}): Middleware {
  return {
    name: 'admin-authentication',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      try {
        // Extract original Next.js request
        const nextRequest = (request as any).originalRequest as NextRequest;
        if (!nextRequest) {
          return {
            error: 'Authentication context not available',
            status: 500
          };
        }

        // Use existing requireAdmin function for authentication
        const adminUser = await requireAdmin(nextRequest);
        
        // Get bearer token
        const token = await getBearerToken(nextRequest);
        
        // Create admin user object
        const user: AdminUser = {
          user_id: adminUser.user_id,
          email: adminUser.email,
          username: adminUser.username,
          is_admin: true
        };

        // Get user permissions (for now, all admins have all permissions)
        const permissions = Object.values(AdminPermissions);

        // Check specific permissions if required
        if (config.permissions && config.permissions.length > 0) {
          const hasPermission = config.permissions.some(perm => permissions.includes(perm));
          if (!hasPermission) {
            return {
              error: `Insufficient permissions. Required: ${config.permissions.join(', ')}`,
              status: 403
            };
          }
        }

        // Check operation permissions if required
        if (config.operations && config.operations.length > 0) {
          const hasOperationPermission = config.operations.some(operation => {
            const requiredPerms = AdminOperations[operation as keyof typeof AdminOperations] || [];
            return requiredPerms.length === 0 || requiredPerms.some(perm => permissions.includes(perm));
          });
          
          if (!hasOperationPermission) {
            return {
              error: `Insufficient permissions for operations: ${config.operations.join(', ')}`,
              status: 403
            };
          }
        }

        // Add admin context to request
        request.user = user;
        (request as any).adminContext = {
          user,
          permissions,
          token,
          operation: config.operations?.[0]
        } as AdminContext;

        return request;

      } catch (error: any) {
        // requireAdmin throws NextResponse for auth failures
        if (error instanceof Response) {
          const errorData = await error.json().catch(() => ({ error: 'Authentication failed' }));
          return {
            error: errorData.error || 'Authentication failed',
            status: error.status
          };
        }
        
        return {
          error: error?.message || 'Authentication failed',
          status: 500
        };
      }
    }
  };
}

/**
 * Default admin authentication middleware
 */
export const adminAuthMiddleware = createAdminAuthMiddleware();

/**
 * Create operation-specific middleware
 */
export function createOperationMiddleware(operation: string): Middleware {
  return createAdminAuthMiddleware({ operations: [operation] });
}

/**
 * Create permission-specific middleware
 */
export function createPermissionMiddleware(permissions: string[]): Middleware {
  return createAdminAuthMiddleware({ permissions });
}

/**
 * Admin permission checker utility
 */
export class AdminPermissionChecker {
  /**
   * Check if admin has specific permission
   */
  static hasPermission(context: AdminContext, permission: string): boolean {
    return context.permissions.includes(permission);
  }

  /**
   * Check if admin has any of the specified permissions
   */
  static hasAnyPermission(context: AdminContext, permissions: string[]): boolean {
    return permissions.some(permission => context.permissions.includes(permission));
  }

  /**
   * Check if admin has all of the specified permissions
   */
  static hasAllPermissions(context: AdminContext, permissions: string[]): boolean {
    return permissions.every(permission => context.permissions.includes(permission));
  }

  /**
   * Check if admin can perform specific operation
   */
  static canPerformOperation(context: AdminContext, operation: string): boolean {
    const requiredPermissions = AdminOperations[operation as keyof typeof AdminOperations];
    if (!requiredPermissions) {
      return true; // Unknown operations are allowed by default
    }
    
    if (requiredPermissions.length === 0) {
      return true; // No permissions required
    }
    
    return this.hasAnyPermission(context, requiredPermissions);
  }

  /**
   * Get required permissions for operation
   */
  static getRequiredPermissions(operation: string): string[] {
    return AdminOperations[operation as keyof typeof AdminOperations] || [];
  }

  /**
   * Get all available permissions
   */
  static getAllPermissions(): string[] {
    return Object.values(AdminPermissions);
  }

  /**
   * Get all available operations
   */
  static getAllOperations(): string[] {
    return Object.keys(AdminOperations);
  }
}

/**
 * Bearer token handling utilities
 */
export class AdminTokenHandler {
  /**
   * Extract admin context from request
   */
  static getAdminContext(request: APIRequest): AdminContext | null {
    return (request as any).adminContext || null;
  }

  /**
   * Get bearer token from admin context
   */
  static getBearerToken(request: APIRequest): string | null {
    const context = this.getAdminContext(request);
    return context?.token || null;
  }

  /**
   * Get admin user from request
   */
  static getAdminUser(request: APIRequest): AdminUser | null {
    const context = this.getAdminContext(request);
    return context?.user || null;
  }

  /**
   * Check if request has admin context
   */
  static hasAdminContext(request: APIRequest): boolean {
    return this.getAdminContext(request) !== null;
  }
}

/**
 * Middleware combinations for common admin operations
 */
export const AdminMiddleware = {
  // Basic admin authentication
  basic: adminAuthMiddleware,
  
  // Exam management
  examManagement: createPermissionMiddleware([AdminPermissions.MANAGE_EXAMS]),
  examCreate: createPermissionMiddleware([AdminPermissions.CREATE_EXAMS]),
  examEdit: createPermissionMiddleware([AdminPermissions.EDIT_EXAMS]),
  examDelete: createPermissionMiddleware([AdminPermissions.DELETE_EXAMS]),
  
  // Student management
  studentManagement: createPermissionMiddleware([AdminPermissions.MANAGE_STUDENTS]),
  studentCreate: createPermissionMiddleware([AdminPermissions.CREATE_STUDENTS]),
  studentEdit: createPermissionMiddleware([AdminPermissions.EDIT_STUDENTS]),
  studentDelete: createPermissionMiddleware([AdminPermissions.DELETE_STUDENTS]),
  bulkOperations: createPermissionMiddleware([AdminPermissions.BULK_OPERATIONS]),
  
  // System administration
  systemSettings: createPermissionMiddleware([AdminPermissions.MANAGE_SETTINGS]),
  monitoring: createPermissionMiddleware([AdminPermissions.VIEW_MONITORING]),
  auditLogs: createPermissionMiddleware([AdminPermissions.VIEW_AUDIT_LOGS]),
  systemControl: createPermissionMiddleware([AdminPermissions.SYSTEM_CONTROL]),
  
  // Data operations
  dataExport: createPermissionMiddleware([AdminPermissions.EXPORT_DATA]),
  dataImport: createPermissionMiddleware([AdminPermissions.IMPORT_DATA]),
  
  // File operations
  fileUpload: createPermissionMiddleware([AdminPermissions.UPLOAD_FILES]),
  
  // WhatsApp integration
  whatsapp: createPermissionMiddleware([AdminPermissions.WHATSAPP_INTEGRATION])
};