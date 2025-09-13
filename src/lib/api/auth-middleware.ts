import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { APIRequest, APIResponse, Middleware, AuthenticatedUser } from "./unified-handler";

/**
 * Authentication and authorization middleware for unified API handlers
 */

interface TokenPayload {
  sub: string;
  email?: string | null;
  username?: string | null;
  is_admin?: boolean;
  iat?: number;
  exp?: number;
}

interface AuthConfig {
  required: boolean;
  adminRequired: boolean;
  permissions?: string[];
}

// In-memory cache for user permissions (in production, use Redis or similar)
const permissionCache = new Map<string, { permissions: string[]; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get authentication secret
 */
function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-secret-do-not-use-in-prod"
  );
}

/**
 * Extract and verify JWT token from request
 */
async function verifyToken(req: NextRequest): Promise<TokenPayload | null> {
  try {
    // Try cookie first (for web app)
    let token = req.cookies.get("auth_token")?.value;
    
    // Fallback to Authorization header (for API clients)
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return null;
    }

    const secret = new TextEncoder().encode(getAuthSecret());
    const { payload } = await jwtVerify(token, secret);
    return payload as TokenPayload;
  } catch (error) {
    console.warn("Token verification failed:", error);
    return null;
  }
}

/**
 * Get user permissions from cache or database
 */
async function getUserPermissions(userId: string): Promise<string[]> {
  // Check cache first
  const cached = permissionCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.permissions;
  }

  // In a real implementation, fetch from database
  // For now, return basic permissions based on admin status
  const permissions = ['read']; // Basic permission for all authenticated users
  
  // Cache the permissions
  permissionCache.set(userId, {
    permissions,
    expires: Date.now() + CACHE_TTL
  });

  return permissions;
}

/**
 * Clear user permissions from cache
 */
export function clearUserPermissionCache(userId: string): void {
  permissionCache.delete(userId);
}

/**
 * Clear all permissions from cache
 */
export function clearAllPermissionCache(): void {
  permissionCache.clear();
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthConfig): Middleware {
  return {
    name: 'authentication',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      // Extract original Next.js request from context if available
      const nextRequest = (request as any).originalRequest as NextRequest;
      if (!nextRequest) {
        if (config.required) {
          return {
            error: 'Authentication context not available',
            status: 500
          };
        }
        return request;
      }

      // Verify token
      const tokenPayload = await verifyToken(nextRequest);
      
      if (!tokenPayload) {
        if (config.required) {
          return {
            error: 'Authentication required',
            status: 401
          };
        }
        return request;
      }

      // Check if admin is required
      if (config.adminRequired && !tokenPayload.is_admin) {
        return {
          error: 'Admin access required',
          status: 403
        };
      }

      // Get user permissions
      const permissions = await getUserPermissions(tokenPayload.sub);

      // Check specific permissions if required
      if (config.permissions && config.permissions.length > 0) {
        const hasPermission = config.permissions.some(perm => permissions.includes(perm));
        if (!hasPermission) {
          return {
            error: 'Insufficient permissions',
            status: 403
          };
        }
      }

      // Add user to request
      request.user = {
        user_id: tokenPayload.sub,
        email: tokenPayload.email ?? null,
        username: tokenPayload.username ?? undefined,
        is_admin: tokenPayload.is_admin ?? false
      };

      // Add permissions to request context
      (request as any).permissions = permissions;

      return request;
    }
  };
}

/**
 * Middleware for optional authentication
 */
export const optionalAuthMiddleware = createAuthMiddleware({
  required: false,
  adminRequired: false
});

/**
 * Middleware for required authentication
 */
export const requiredAuthMiddleware = createAuthMiddleware({
  required: true,
  adminRequired: false
});

/**
 * Middleware for admin authentication
 */
export const adminAuthMiddleware = createAuthMiddleware({
  required: true,
  adminRequired: true
});

/**
 * Create permission-based middleware
 */
export function createPermissionMiddleware(permissions: string[]): Middleware {
  return createAuthMiddleware({
    required: true,
    adminRequired: false,
    permissions
  });
}

/**
 * Role-based access control utilities
 */
export class RoleBasedAccessControl {
  private static roles = new Map<string, string[]>([
    ['admin', ['read', 'write', 'delete', 'manage_users', 'manage_exams', 'view_audit']],
    ['teacher', ['read', 'write', 'manage_exams']],
    ['student', ['read']],
    ['guest', []]
  ]);

  /**
   * Check if user has specific permission
   */
  static hasPermission(user: AuthenticatedUser, permission: string): boolean {
    if (user.is_admin) {
      return true; // Admins have all permissions
    }

    // In a real implementation, fetch user roles from database
    // For now, assume non-admin users have 'student' role
    const userRole = 'student';
    const rolePermissions = this.roles.get(userRole) || [];
    
    return rolePermissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(user: AuthenticatedUser, permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  static hasAllPermissions(user: AuthenticatedUser, permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  /**
   * Get all permissions for a user
   */
  static getUserPermissions(user: AuthenticatedUser): string[] {
    if (user.is_admin) {
      return this.roles.get('admin') || [];
    }

    // In a real implementation, fetch user roles from database
    const userRole = 'student';
    return this.roles.get(userRole) || [];
  }

  /**
   * Add new role
   */
  static addRole(role: string, permissions: string[]): void {
    this.roles.set(role, permissions);
  }

  /**
   * Update role permissions
   */
  static updateRole(role: string, permissions: string[]): void {
    if (this.roles.has(role)) {
      this.roles.set(role, permissions);
    }
  }

  /**
   * Remove role
   */
  static removeRole(role: string): void {
    this.roles.delete(role);
  }
}

/**
 * Create RBAC middleware
 */
export function createRBACMiddleware(requiredPermissions: string[]): Middleware {
  return {
    name: 'rbac',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      if (!request.user) {
        return {
          error: 'Authentication required for RBAC check',
          status: 401
        };
      }

      const hasPermission = RoleBasedAccessControl.hasAnyPermission(
        request.user,
        requiredPermissions
      );

      if (!hasPermission) {
        return {
          error: `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
          status: 403
        };
      }

      return request;
    }
  };
}

/**
 * Token validation utilities
 */
export class TokenValidator {
  /**
   * Validate token expiration
   */
  static isTokenExpired(payload: TokenPayload): boolean {
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  }

  /**
   * Validate token issuer
   */
  static isValidIssuer(payload: TokenPayload, expectedIssuer: string): boolean {
    return (payload as any).iss === expectedIssuer;
  }

  /**
   * Validate token audience
   */
  static isValidAudience(payload: TokenPayload, expectedAudience: string): boolean {
    const aud = (payload as any).aud;
    if (Array.isArray(aud)) {
      return aud.includes(expectedAudience);
    }
    return aud === expectedAudience;
  }

  /**
   * Get token remaining time in seconds
   */
  static getTokenRemainingTime(payload: TokenPayload): number {
    if (!payload.exp) return Infinity;
    return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  }
}

/**
 * Session management utilities
 */
export class SessionManager {
  private static activeSessions = new Map<string, { userId: string; expires: number }>();

  /**
   * Create session
   */
  static createSession(sessionId: string, userId: string, expiresIn: number): void {
    this.activeSessions.set(sessionId, {
      userId,
      expires: Date.now() + expiresIn
    });
  }

  /**
   * Validate session
   */
  static isValidSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    
    if (session.expires < Date.now()) {
      this.activeSessions.delete(sessionId);
      return false;
    }
    
    return true;
  }

  /**
   * Invalidate session
   */
  static invalidateSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  /**
   * Invalidate all sessions for user
   */
  static invalidateUserSessions(userId: string): void {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Clean expired sessions
   */
  static cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expires < now) {
        this.activeSessions.delete(sessionId);
      }
    }
  }
}

// Clean expired sessions every 5 minutes
setInterval(() => {
  SessionManager.cleanExpiredSessions();
}, 5 * 60 * 1000);