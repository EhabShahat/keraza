/**
 * Edge-Compatible JWT Validation and User Lookup
 * Optimized for Netlify Edge Functions with minimal dependencies
 */

export interface EdgeJWTPayload {
  sub?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

export interface EdgeAuthResult {
  valid: boolean;
  payload?: EdgeJWTPayload;
  error?: string;
  user?: EdgeUser;
}

export interface EdgeUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
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
 * Edge-compatible JWT validation
 * Simplified version that works in edge runtime without external dependencies
 */
export function validateEdgeJWT(token: string): EdgeAuthResult {
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

    // Create user object
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
 * Get permissions for a role
 */
function getPermissionsForRole(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    'super_admin': [
      'admin:read',
      'admin:write',
      'admin:delete',
      'system:manage',
      'users:manage',
      'exams:manage',
      'results:view',
      'audit:view'
    ],
    'admin': [
      'admin:read',
      'admin:write',
      'exams:manage',
      'results:view',
      'students:manage'
    ],
    'user': [
      'exams:take',
      'results:view_own'
    ]
  };

  return rolePermissions[role] || rolePermissions['user'];
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: EdgeUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

/**
 * Check if user has admin access
 */
export function isAdmin(user: EdgeUser): boolean {
  return user.role === 'admin' || user.role === 'super_admin';
}

/**
 * Check if user has super admin access
 */
export function isSuperAdmin(user: EdgeUser): boolean {
  return user.role === 'super_admin';
}

/**
 * Extract token from various sources
 */
export function extractTokenFromRequest(request: Request): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    return cookies.token || cookies.auth_token || null;
  }

  // Check query parameters (less secure, only for specific cases)
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) {
    return tokenParam;
  }

  return null;
}

/**
 * Parse cookies from header string
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const [key, ...valueParts] = cookie.trim().split('=');
    if (key && valueParts.length > 0) {
      cookies[key] = valueParts.join('=');
    }
  });
  
  return cookies;
}

/**
 * Create authentication context for edge functions
 */
export interface EdgeAuthContext {
  isAuthenticated: boolean;
  user?: EdgeUser;
  token?: string;
  error?: string;
}

/**
 * Create authentication context from request
 */
export function createEdgeAuthContext(request: Request): EdgeAuthContext {
  const token = extractTokenFromRequest(request);
  
  if (!token) {
    return {
      isAuthenticated: false,
      error: 'No authentication token found'
    };
  }

  const authResult = validateEdgeJWT(token);
  
  if (!authResult.valid) {
    return {
      isAuthenticated: false,
      error: authResult.error,
      token
    };
  }

  return {
    isAuthenticated: true,
    user: authResult.user,
    token
  };
}

/**
 * Middleware factory for edge authentication
 */
export function createEdgeAuthMiddleware(options: {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requiredPermissions?: string[];
} = {}) {
  return (request: Request): Response | null => {
    const authContext = createEdgeAuthContext(request);
    
    // Check if authentication is required
    if (options.requireAuth && !authContext.isAuthenticated) {
      return new Response(JSON.stringify({
        error: 'Authentication required',
        message: authContext.error || 'Please provide a valid authentication token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer'
        }
      });
    }

    // Check admin requirement
    if (options.requireAdmin && authContext.user && !isAdmin(authContext.user)) {
      return new Response(JSON.stringify({
        error: 'Admin access required',
        message: 'This endpoint requires administrator privileges'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Check specific permissions
    if (options.requiredPermissions && authContext.user) {
      const hasAllPermissions = options.requiredPermissions.every(
        permission => hasPermission(authContext.user!, permission)
      );
      
      if (!hasAllPermissions) {
        return new Response(JSON.stringify({
          error: 'Insufficient permissions',
          message: 'You do not have the required permissions for this action',
          required: options.requiredPermissions
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // Authentication successful - return null to continue
    return null;
  };
}

/**
 * Add authentication headers to request for downstream processing
 */
export function addAuthHeaders(request: Request, authContext: EdgeAuthContext): Request {
  if (!authContext.isAuthenticated || !authContext.user) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set('X-User-ID', authContext.user.id);
  headers.set('X-User-Email', authContext.user.email);
  headers.set('X-User-Role', authContext.user.role);
  headers.set('X-User-Permissions', authContext.user.permissions.join(','));
  headers.set('X-Auth-Valid', 'true');

  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
    // @ts-ignore - Edge runtime compatibility
    duplex: 'half'
  });
}