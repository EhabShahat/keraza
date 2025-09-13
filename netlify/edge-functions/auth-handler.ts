/**
 * Optimized Netlify Edge Function for Authentication Token Validation
 * Handles JWT validation and user lookup at the edge for optimal performance
 */

import type { Context } from "https://edge.netlify.com";

// Import edge auth utilities (inline for edge function compatibility)
interface EdgeJWTPayload {
  sub?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

interface EdgeAuthResult {
  valid: boolean;
  payload?: EdgeJWTPayload;
  error?: string;
  user?: EdgeUser;
}

interface EdgeUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

/**
 * Edge-optimized authentication cache
 */
class EdgeAuthCache {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static cache = new Map<string, { data: EdgeAuthResult; timestamp: number }>();

  static get(token: string): EdgeAuthResult | null {
    const entry = this.cache.get(token);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL * 1000) {
      this.cache.delete(token);
      return null;
    }

    return entry.data;
  }

  static set(token: string, result: EdgeAuthResult): void {
    // Only cache successful validations
    if (result.valid) {
      this.cache.set(token, {
        data: result,
        timestamp: Date.now()
      });
    }
  }

  static invalidate(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Get permissions for a role
 */
function getPermissionsForRole(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    'super_admin': [
      'admin:read', 'admin:write', 'admin:delete',
      'system:manage', 'users:manage', 'exams:manage',
      'results:view', 'audit:view', 'settings:manage'
    ],
    'admin': [
      'admin:read', 'admin:write', 'exams:manage',
      'results:view', 'students:manage', 'settings:view'
    ],
    'moderator': [
      'admin:read', 'exams:view', 'students:view',
      'results:view', 'analytics:view'
    ],
    'user': [
      'exams:take', 'results:view_own'
    ]
  };

  return rolePermissions[role] || rolePermissions['user'];
}

/**
 * Edge-compatible base64url decoder
 */
function base64urlDecode(str: string): string {
  // Add padding if needed
  const padded = str + '='.repeat((4 - str.length % 4) % 4);
  
  // Replace URL-safe characters
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  
  try {
    // Use built-in atob for edge compatibility
    return atob(base64);
  } catch (error) {
    throw new Error('Invalid base64url encoding');
  }
}

/**
 * Enhanced JWT validation for edge runtime
 */
function validateEdgeJWT(token: string): EdgeAuthResult {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Invalid token format' };
    }

    // For the current simplified token format (base64url encoded JSON)
    let payload: EdgeJWTPayload;
    
    try {
      const decoded = base64urlDecode(token);
      payload = JSON.parse(decoded) as EdgeJWTPayload;
    } catch (error) {
      return { valid: false, error: 'Token decode failed' };
    }

    // Basic validation
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Invalid payload format' };
    }

    // Check required fields
    if (!payload.iat || !payload.exp) {
      return { valid: false, error: 'Missing required token fields' };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    // Check not before (if present)
    if (payload.nbf && payload.nbf > now) {
      return { valid: false, error: 'Token not yet valid' };
    }

    // Check issuer (if present)
    if (payload.iss && payload.iss !== 'exam-app') {
      return { valid: false, error: 'Invalid issuer' };
    }

    // Check audience (if present)
    if (payload.aud && payload.aud !== 'authenticated') {
      return { valid: false, error: 'Invalid audience' };
    }

    // Create user object with permissions
    const user: EdgeUser = {
      id: payload.sub || 'unknown',
      email: payload.email || 'unknown',
      role: payload.role || 'user',
      permissions: getPermissionsForRole(payload.role || 'user')
    };

    return {
      valid: true,
      payload,
      user
    };

  } catch (error) {
    return {
      valid: false,
      error: `JWT validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Extract token from request headers
 */
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Also check for token in cookies
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
 * Check if user has specific permission
 */
function hasPermission(user: EdgeUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

/**
 * Validate admin permissions
 */
function validateAdminAccess(authResult: EdgeAuthResult): boolean {
  if (!authResult.valid || !authResult.user) {
    return false;
  }
  
  return authResult.user.role === 'admin' || authResult.user.role === 'super_admin';
}

/**
 * Create authentication response
 */
function createAuthResponse(authResult: EdgeAuthResult, includeUser: boolean = false): Response {
  const responseData: any = {
    valid: authResult.valid,
    error: authResult.error
  };
  
  if (includeUser && authResult.user) {
    responseData.user = {
      id: authResult.user.id,
      email: authResult.user.email,
      role: authResult.user.role,
      permissions: authResult.user.permissions
    };
  }
  
  const status = authResult.valid ? 200 : 401;
  
  return new Response(JSON.stringify(responseData), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'X-Edge-Function': 'auth-handler'
    }
  });
}

/**
 * Handle authentication middleware for protected routes
 */
function handleAuthMiddleware(request: Request, authResult: EdgeAuthResult): Response | null {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Check if this is an admin route
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!validateAdminAccess(authResult)) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Admin access required',
        required_permissions: ['admin:read']
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Error': 'admin-required'
        }
      });
    }
  }
  
  // Add user context to request headers for downstream processing
  if (authResult.valid && authResult.user) {
    const headers = new Headers(request.headers);
    headers.set('X-User-ID', authResult.user.id);
    headers.set('X-User-Email', authResult.user.email);
    headers.set('X-User-Role', authResult.user.role);
    headers.set('X-User-Permissions', authResult.user.permissions.join(','));
    headers.set('X-Auth-Valid', 'true');
    
    return new Request(request.url, {
      method: request.method,
      headers,
      body: request.body,
      // @ts-ignore - Edge runtime compatibility
      duplex: 'half'
    }) as any;
  }
  
  return null;
}

/**
 * Main edge function handler
 */
export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Handle explicit auth validation endpoints
    if (pathname === '/api/edge/validate-token') {
      const token = extractToken(request);
      
      if (!token) {
        return createAuthResponse({ valid: false, error: 'No token provided' });
      }
      
      // Check cache first
      let authResult = EdgeAuthCache.get(token);
      
      if (!authResult) {
        // Validate token
        authResult = validateEdgeJWT(token);
        EdgeAuthCache.set(token, authResult);
      }
      
      const includeUser = url.searchParams.get('include_user') === 'true';
      return createAuthResponse(authResult, includeUser);
    }
    
    // Handle auth cache invalidation
    if (pathname === '/api/edge/invalidate-auth' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { pattern } = body;
        
        EdgeAuthCache.invalidate(pattern);
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // Authentication middleware for protected routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      const token = extractToken(request);
      
      if (!token) {
        return new Response(JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Error': 'no-token'
          }
        });
      }
      
      // Check cache first
      let authResult = EdgeAuthCache.get(token);
      
      if (!authResult) {
        // Validate token
        authResult = validateEdgeJWT(token);
        EdgeAuthCache.set(token, authResult);
      }
      
      // Handle authentication middleware
      const middlewareResult = handleAuthMiddleware(request, authResult);
      if (middlewareResult) {
        return middlewareResult;
      }
    }
    
  } catch (error) {
    console.error('Auth edge function error:', error);
    
    // For auth errors, we should be more strict
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      return new Response(JSON.stringify({
        error: 'Authentication service error',
        message: 'Please try again later'
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Edge-Error': 'auth-service-error'
        }
      });
    }
  }
  
  // Pass through to origin for unhandled paths
  return context.next();
};

/**
 * Edge function configuration
 */
export const config = {
  path: [
    "/api/edge/validate-token",
    "/api/edge/invalidate-auth",
    "/admin/*",
    "/api/admin/*"
  ],
  cache: "manual"
};