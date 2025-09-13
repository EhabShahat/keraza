import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { handleError, performanceMiddleware } from "./error-handler";
import { createMonitoringMiddleware } from "./monitoring";

// Types for the unified API handler
export interface APIRequest {
  path: string[];
  method: string;
  body: any;
  query: Record<string, string>;
  headers: Record<string, string>;
  user?: AuthenticatedUser;
  params?: Record<string, string>;
}

export interface APIResponse {
  data?: any;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

export interface AuthenticatedUser {
  user_id: string;
  email: string | null;
  username?: string | null;
  is_admin?: boolean;
}

export interface RouteHandler {
  path: string;
  method: string;
  handler: (request: APIRequest) => Promise<APIResponse>;
  middleware?: Middleware[];
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

export interface Middleware {
  name: string;
  handler: (request: APIRequest) => Promise<APIRequest | APIResponse>;
}

export interface CacheConfig {
  strategy: 'none' | 'memory' | 'edge' | 'database';
  ttl: number;
  tags: string[];
  invalidation?: InvalidationRule[];
}

export interface InvalidationRule {
  trigger: string;
  tags: string[];
}

/**
 * Base class for unified API handlers with path-based routing
 */
export class UnifiedAPIHandler {
  private routes: Map<string, RouteHandler> = new Map();
  private globalMiddleware: Middleware[] = [];

  constructor() {
    // Add default middleware
    this.addGlobalMiddleware({
      name: 'request-parser',
      handler: this.parseRequest.bind(this)
    });

    this.addGlobalMiddleware(performanceMiddleware);
    this.addGlobalMiddleware(createMonitoringMiddleware());

    this.addGlobalMiddleware({
      name: 'error-handler',
      handler: this.handleErrors.bind(this)
    });
  }

  /**
   * Add a route handler
   */
  addRoute(route: RouteHandler): void {
    const key = `${route.method.toUpperCase()}:${route.path}`;
    this.routes.set(key, route);
  }

  /**
   * Add global middleware that runs for all routes
   */
  addGlobalMiddleware(middleware: Middleware): void {
    this.globalMiddleware.push(middleware);
  }

  /**
   * Main handler method for Next.js API routes
   */
  async handle(req: NextRequest, context?: { params?: Promise<Record<string, string>> }): Promise<NextResponse> {
    let processedRequest: APIRequest | undefined;
    
    try {
      // Parse request parameters
      const params = context?.params ? await context.params : {};
      
      // Create API request object
      const apiRequest = await this.createAPIRequest(req, params);
      
      // Add original request to context for auth middleware
      (apiRequest as any).originalRequest = req;
      
      // Find matching route
      const route = this.findRoute(apiRequest);
      if (!route) {
        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
      }

      // Run global middleware
      processedRequest = apiRequest;
      for (const middleware of this.globalMiddleware) {
        const result = await middleware.handler(processedRequest);
        if (this.isAPIResponse(result)) {
          return this.formatResponse(result, processedRequest);
        }
        processedRequest = result as APIRequest;
      }

      // Run route-specific middleware
      if (route.middleware) {
        for (const middleware of route.middleware) {
          const result = await middleware.handler(processedRequest);
          if (this.isAPIResponse(result)) {
            return this.formatResponse(result, processedRequest);
          }
          processedRequest = result as APIRequest;
        }
      }

      // Execute route handler
      const response = await route.handler(processedRequest);
      
      // Record performance metrics
      if ((processedRequest as any).recordPerformance) {
        (processedRequest as any).recordPerformance();
      }
      
      // Record monitoring metrics
      if ((processedRequest as any).monitoring?.recordMetric) {
        (processedRequest as any).monitoring.recordMetric(response.status || 200);
      }
      
      return this.formatResponse(response, processedRequest);

    } catch (error: any) {
      console.error('Unified API Handler Error:', error);
      
      // Handle error using centralized error handler
      const errorResponse = handleError(error, processedRequest);
      
      // Record monitoring metrics for error
      if (processedRequest && (processedRequest as any).monitoring?.recordMetric) {
        (processedRequest as any).monitoring.recordMetric(errorResponse.status || 500, errorResponse.headers?.['X-Error-ID']);
      }
      
      return this.formatResponse(errorResponse, processedRequest);
    }
  }

  /**
   * Create APIRequest object from Next.js request
   */
  private async createAPIRequest(req: NextRequest, params: Record<string, string> = {}): Promise<APIRequest> {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Remove 'api' from path segments if present
    if (pathSegments[0] === 'api') {
      pathSegments.shift();
    }

    // Parse query parameters
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // Parse headers
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Parse body for POST/PUT/PATCH requests
    let body: any = null;
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        const text = await req.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch (error) {
        // If JSON parsing fails, keep body as null
        console.warn('Failed to parse request body as JSON:', error);
      }
    }

    return {
      path: pathSegments,
      method: req.method,
      body,
      query,
      headers,
      params
    };
  }

  /**
   * Find matching route for the request
   */
  private findRoute(request: APIRequest): RouteHandler | null {
    const method = request.method.toUpperCase();
    
    // Try exact path match first
    const exactKey = `${method}:${request.path.join('/')}`;
    if (this.routes.has(exactKey)) {
      return this.routes.get(exactKey)!;
    }

    // Try pattern matching for dynamic routes
    for (const [key, route] of this.routes.entries()) {
      const [routeMethod, routePath] = key.split(':');
      if (routeMethod !== method) continue;

      if (this.matchesPattern(request.path, routePath.split('/'))) {
        return route;
      }
    }

    return null;
  }

  /**
   * Check if request path matches route pattern
   */
  private matchesPattern(requestPath: string[], routePattern: string[]): boolean {
    if (requestPath.length !== routePattern.length) {
      return false;
    }

    for (let i = 0; i < requestPath.length; i++) {
      const requestSegment = requestPath[i];
      const patternSegment = routePattern[i];

      // Dynamic segment (starts with [)
      if (patternSegment.startsWith('[') && patternSegment.endsWith(']')) {
        continue;
      }

      // Exact match required
      if (requestSegment !== patternSegment) {
        return false;
      }
    }

    return true;
  }

  /**
   * Parse request middleware
   */
  private async parseRequest(request: APIRequest): Promise<APIRequest> {
    // Add any request parsing logic here
    return request;
  }

  /**
   * Error handling middleware
   */
  private async handleErrors(request: APIRequest): Promise<APIRequest> {
    // Add any error handling logic here
    return request;
  }

  /**
   * Check if result is an API response
   */
  private isAPIResponse(result: any): result is APIResponse {
    return result && (result.data !== undefined || result.error !== undefined || result.status !== undefined);
  }

  /**
   * Format API response to Next.js response
   */
  private formatResponse(response: APIResponse, request?: APIRequest): NextResponse {
    const status = response.status || (response.error ? 400 : 200);
    const body = response.error ? { error: response.error } : response.data;
    
    const nextResponse = NextResponse.json(body, { status });
    
    // Add custom headers if provided in response
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        nextResponse.headers.set(key, value);
      });
    }

    // Add headers from middleware if available
    if (request) {
      // Add rate limit headers
      if ((request as any).rateLimitHeaders) {
        Object.entries((request as any).rateLimitHeaders).forEach(([key, value]) => {
          nextResponse.headers.set(key, value as string);
        });
      }
      
      // Add security headers
      if ((request as any).securityHeaders) {
        Object.entries((request as any).securityHeaders).forEach(([key, value]) => {
          nextResponse.headers.set(key, value as string);
        });
      }
    }

    return nextResponse;
  }

  /**
   * Get Supabase client with optional user token
   */
  protected getSupabaseClient(request: APIRequest) {
    // For now, we don't forward user tokens to Supabase
    // This matches the current getBearerToken implementation
    return supabaseServer();
  }
}