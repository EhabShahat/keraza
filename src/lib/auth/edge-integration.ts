/**
 * Edge Authentication Integration
 * Provides utilities to integrate edge-optimized authentication with the main application
 */

import { EdgeFunctionClient } from '@/lib/edge/edge-integration';

/**
 * Edge authentication client
 */
export class EdgeAuthClient extends EdgeFunctionClient {
  /**
   * Validate token using edge function
   */
  async validateToken(token: string, includeUser: boolean = true) {
    return super.validateToken(token, includeUser);
  }

  /**
   * Create session using edge authentication
   */
  async createSession(token: string): Promise<{
    success: boolean;
    sessionId?: string;
    user?: any;
    error?: string;
  }> {
    try {
      const validation = await this.validateToken(token, true);
      
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Token validation failed'
        };
      }

      // For now, we'll use the token as session ID
      // In a full implementation, this would create a proper session
      return {
        success: true,
        sessionId: token,
        user: validation.user
      };
    } catch (error) {
      return {
        success: false,
        error: `Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate session using edge function
   */
  async validateSession(sessionId: string): Promise<{
    valid: boolean;
    user?: any;
    error?: string;
  }> {
    // For now, treat session ID as token
    // In a full implementation, this would validate the session
    return this.validateToken(sessionId, true);
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Invalidate the specific token/session
      const result = await this.invalidateAuthCache(sessionId);
      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `Session destruction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Edge authentication middleware for Next.js API routes
 */
export function withEdgeAuth(
  handler: (req: any, res: any, user: any) => Promise<any>,
  options: {
    requireAdmin?: boolean;
    requiredPermissions?: string[];
  } = {}
) {
  return async (req: any, res: any) => {
    try {
      // Extract token from request
      const token = extractTokenFromNextRequest(req);
      
      if (!token) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'No authentication token provided'
        });
      }

      // Validate using edge function
      const edgeClient = new EdgeAuthClient();
      const validation = await edgeClient.validateToken(token, true);
      
      if (!validation.valid) {
        return res.status(401).json({
          error: 'Invalid token',
          message: validation.error || 'Token validation failed'
        });
      }

      const user = validation.user;
      
      // Check admin requirement
      if (options.requireAdmin && !isAdminUser(user)) {
        return res.status(403).json({
          error: 'Admin access required',
          message: 'This endpoint requires administrator privileges'
        });
      }

      // Check specific permissions
      if (options.requiredPermissions && !hasRequiredPermissions(user, options.requiredPermissions)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You do not have the required permissions for this action',
          required: options.requiredPermissions
        });
      }

      // Call the handler with the authenticated user
      return handler(req, res, user);
      
    } catch (error) {
      console.error('Edge auth middleware error:', error);
      return res.status(500).json({
        error: 'Authentication service error',
        message: 'Please try again later'
      });
    }
  };
}

/**
 * Extract token from Next.js request
 */
function extractTokenFromNextRequest(req: any): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  const cookies = req.cookies;
  if (cookies) {
    return cookies.token || cookies.auth_token || null;
  }

  return null;
}

/**
 * Check if user is admin
 */
function isAdminUser(user: any): boolean {
  return user && (user.role === 'admin' || user.role === 'super_admin');
}

/**
 * Check if user has required permissions
 */
function hasRequiredPermissions(user: any, requiredPermissions: string[]): boolean {
  if (!user || !user.permissions) {
    return false;
  }

  return requiredPermissions.every(permission => 
    user.permissions.includes(permission)
  );
}

/**
 * Edge authentication hook for React components
 */
export function useEdgeAuth() {
  const edgeClient = new EdgeAuthClient();

  const validateToken = async (token: string) => {
    return edgeClient.validateToken(token, true);
  };

  const createSession = async (token: string) => {
    return edgeClient.createSession(token);
  };

  const validateSession = async (sessionId: string) => {
    return edgeClient.validateSession(sessionId);
  };

  const destroySession = async (sessionId: string) => {
    return edgeClient.destroySession(sessionId);
  };

  const invalidateAuth = async (pattern?: string) => {
    return edgeClient.invalidateAuthCache(pattern);
  };

  return {
    validateToken,
    createSession,
    validateSession,
    destroySession,
    invalidateAuth
  };
}

/**
 * Server-side authentication utilities
 */
export class ServerEdgeAuth {
  private static client = new EdgeAuthClient();

  /**
   * Validate request authentication on server-side
   */
  static async validateRequest(request: Request): Promise<{
    authenticated: boolean;
    user?: any;
    error?: string;
  }> {
    try {
      const token = this.extractTokenFromRequest(request);
      
      if (!token) {
        return {
          authenticated: false,
          error: 'No authentication token found'
        };
      }

      const validation = await this.client.validateToken(token, true);
      
      return {
        authenticated: validation.valid,
        user: validation.user,
        error: validation.error
      };
    } catch (error) {
      return {
        authenticated: false,
        error: `Authentication validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract token from request
   */
  private static extractTokenFromRequest(request: Request): string | null {
    // Check Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookies
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      return cookies.token || cookies.auth_token || null;
    }

    return null;
  }

  /**
   * Create authenticated response headers
   */
  static createAuthHeaders(user: any): Record<string, string> {
    return {
      'X-User-ID': user.id,
      'X-User-Email': user.email,
      'X-User-Role': user.role,
      'X-User-Permissions': user.permissions?.join(',') || '',
      'X-Auth-Valid': 'true'
    };
  }
}

/**
 * Default edge auth client instance
 */
export const edgeAuthClient = new EdgeAuthClient();