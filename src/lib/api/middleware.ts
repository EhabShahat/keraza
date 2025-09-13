import { APIRequest, APIResponse, Middleware } from "./unified-handler";
import { validateRequestBody, sanitizeInput, ValidationRule } from "./request-utils";

/**
 * Collection of reusable middleware for unified API handlers
 */

/**
 * Request validation middleware
 */
export function createValidationMiddleware(rules: ValidationRule[]): Middleware {
  return {
    name: 'validation',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      if (!request.body) {
        return request;
      }

      const validation = validateRequestBody(request.body, rules);
      if (!validation.isValid) {
        return {
          error: `Validation failed: ${validation.errors.join(', ')}`,
          status: 400
        };
      }

      // Replace body with validated data
      request.body = validation.data;
      return request;
    }
  };
}

/**
 * Input sanitization middleware
 */
export const sanitizationMiddleware: Middleware = {
  name: 'sanitization',
  handler: async (request: APIRequest): Promise<APIRequest> => {
    if (request.body) {
      request.body = sanitizeInput(request.body);
    }
    
    // Sanitize query parameters
    const sanitizedQuery: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.query)) {
      sanitizedQuery[key] = sanitizeInput(value);
    }
    request.query = sanitizedQuery;

    return request;
  }
};

/**
 * Request logging middleware
 */
export const loggingMiddleware: Middleware = {
  name: 'logging',
  handler: async (request: APIRequest): Promise<APIRequest> => {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      method: request.method,
      path: request.path.join('/'),
      user: request.user?.user_id || 'anonymous',
      query: Object.keys(request.query).length > 0 ? request.query : undefined,
      hasBody: !!request.body
    };

    console.log('API Request:', JSON.stringify(logData));
    return request;
  }
};

/**
 * Rate limiting middleware (basic implementation)
 */
export function createRateLimitMiddleware(
  maxRequests: number,
  windowMs: number,
  keyGenerator?: (request: APIRequest) => string
): Middleware {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return {
    name: 'rate-limit',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      const key = keyGenerator ? keyGenerator(request) : 
        request.user?.user_id || request.headers['x-forwarded-for'] || 'anonymous';
      
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean up old entries
      for (const [k, v] of requests.entries()) {
        if (v.resetTime < windowStart) {
          requests.delete(k);
        }
      }

      const current = requests.get(key) || { count: 0, resetTime: now + windowMs };
      
      if (current.count >= maxRequests && current.resetTime > now) {
        return {
          error: 'Rate limit exceeded',
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(current.resetTime / 1000).toString()
          }
        };
      }

      current.count++;
      requests.set(key, current);

      return request;
    }
  };
}

/**
 * CORS middleware
 */
export function createCorsMiddleware(options: {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}): Middleware {
  return {
    name: 'cors',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      const origin = request.headers.origin;
      const allowedOrigins = Array.isArray(options.origin) ? options.origin : [options.origin || '*'];
      
      // For preflight requests
      if (request.method === 'OPTIONS') {
        return {
          data: null,
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
            'Access-Control-Allow-Methods': (options.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']).join(', '),
            'Access-Control-Allow-Headers': (options.headers || ['Content-Type', 'Authorization']).join(', '),
            'Access-Control-Allow-Credentials': options.credentials ? 'true' : 'false',
            'Access-Control-Max-Age': '86400'
          }
        };
      }

      return request;
    }
  };
}

/**
 * Content-Type validation middleware
 */
export function createContentTypeMiddleware(allowedTypes: string[]): Middleware {
  return {
    name: 'content-type',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers['content-type'] || '';
        const isAllowed = allowedTypes.some(type => contentType.includes(type));
        
        if (!isAllowed) {
          return {
            error: `Unsupported content type. Allowed types: ${allowedTypes.join(', ')}`,
            status: 415
          };
        }
      }

      return request;
    }
  };
}

/**
 * Request size limit middleware
 */
export function createSizeLimitMiddleware(maxSizeBytes: number): Middleware {
  return {
    name: 'size-limit',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      if (request.body) {
        const bodySize = JSON.stringify(request.body).length;
        if (bodySize > maxSizeBytes) {
          return {
            error: `Request body too large. Maximum size: ${maxSizeBytes} bytes`,
            status: 413
          };
        }
      }

      return request;
    }
  };
}

/**
 * Cache control middleware
 */
export function createCacheMiddleware(cacheControl: string): Middleware {
  return {
    name: 'cache-control',
    handler: async (request: APIRequest): Promise<APIRequest> => {
      // Add cache control to request context for response formatting
      (request as any).cacheControl = cacheControl;
      return request;
    }
  };
}

/**
 * Security headers middleware
 */
export const securityHeadersMiddleware: Middleware = {
  name: 'security-headers',
  handler: async (request: APIRequest): Promise<APIRequest> => {
    // Add security headers to request context for response formatting
    (request as any).securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    return request;
  }
};

/**
 * Request timeout middleware
 */
export function createTimeoutMiddleware(timeoutMs: number): Middleware {
  return {
    name: 'timeout',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      // Set timeout context for handler execution
      (request as any).timeout = timeoutMs;
      return request;
    }
  };
}

/**
 * Audit logging middleware for admin actions
 */
export const auditMiddleware: Middleware = {
  name: 'audit',
  handler: async (request: APIRequest): Promise<APIRequest> => {
    if (request.user && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      // Add audit context for later processing
      (request as any).auditLog = {
        user_id: request.user.user_id,
        action: `${request.method} /${request.path.join('/')}`,
        timestamp: new Date().toISOString(),
        ip_address: request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || 'unknown'
      };
    }
    return request;
  }
};

/**
 * Common middleware combinations
 */
export const commonMiddleware = [
  sanitizationMiddleware,
  loggingMiddleware,
  securityHeadersMiddleware
];

export const adminMiddleware = [
  ...commonMiddleware,
  auditMiddleware,
  createRateLimitMiddleware(100, 60000), // 100 requests per minute
  createContentTypeMiddleware(['application/json'])
];

export const publicMiddleware = [
  ...commonMiddleware,
  createRateLimitMiddleware(60, 60000), // 60 requests per minute
  createCacheMiddleware('public, max-age=300') // 5 minutes cache
];