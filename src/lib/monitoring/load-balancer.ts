/**
 * Load Balancer Middleware
 * Handles traffic routing and load balancing for consolidated functions
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoRecoverySystem, FunctionInstance } from './auto-recovery';
import { healthMonitor } from './health-monitor';
import { alertingSystem } from './alerting-system';

export interface LoadBalancerConfig {
  function_name: string;
  base_path: string;
  fallback_endpoint?: string;
  timeout: number;
  retry_attempts: number;
  sticky_session_cookie?: string;
}

export interface RequestContext {
  request_id: string;
  function_name: string;
  start_time: number;
  target_instance?: string;
  retry_count: number;
  user_session?: string;
}

class LoadBalancer {
  private activeRequests: Map<string, RequestContext> = new Map();
  private sessionAffinities: Map<string, string> = new Map(); // session -> instance mapping

  /**
   * Route request to appropriate function instance
   */
  async routeRequest(
    request: NextRequest,
    config: LoadBalancerConfig
  ): Promise<NextResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    const context: RequestContext = {
      request_id: requestId,
      function_name: config.function_name,
      start_time: startTime,
      retry_count: 0,
      user_session: this.extractSessionId(request, config)
    };

    this.activeRequests.set(requestId, context);

    try {
      return await this.executeRequest(request, config, context);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Execute request with retry logic and failover
   */
  private async executeRequest(
    request: NextRequest,
    config: LoadBalancerConfig,
    context: RequestContext
  ): Promise<NextResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.retry_attempts; attempt++) {
      context.retry_count = attempt;

      try {
        // Get target instance
        const targetEndpoint = this.selectTargetInstance(config, context);
        
        if (!targetEndpoint) {
          // No healthy instances available
          if (config.fallback_endpoint) {
            return await this.executeFallback(request, config, context);
          } else {
            throw new Error(`No healthy instances available for ${config.function_name}`);
          }
        }

        context.target_instance = targetEndpoint;

        // Execute request
        const response = await this.forwardRequest(request, targetEndpoint, config, context);
        
        // Update connection count
        this.updateConnectionCount(targetEndpoint, -1);
        
        // Record successful request
        this.recordRequestMetrics(context, response.status, Date.now() - context.start_time);
        
        return response;

      } catch (error) {
        lastError = error as Error;
        
        // Update connection count on error
        if (context.target_instance) {
          this.updateConnectionCount(context.target_instance, -1);
        }

        // Record failed request
        this.recordRequestMetrics(context, 500, Date.now() - context.start_time, error as Error);

        // Check if we should retry
        if (attempt < config.retry_attempts && this.shouldRetry(error as Error)) {
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
          continue;
        }
      }
    }

    // All retries failed
    alertingSystem.sendAlert({
      type: 'load_balancer_failure',
      severity: 'critical',
      message: `Load balancer failed to route request for ${config.function_name}`,
      metadata: {
        function_name: config.function_name,
        request_id: context.request_id,
        retry_count: context.retry_count,
        error: lastError?.message
      }
    });

    return new NextResponse(
      JSON.stringify({
        error: 'Service temporarily unavailable',
        request_id: context.request_id
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  /**
   * Select target instance based on load balancing strategy
   */
  private selectTargetInstance(config: LoadBalancerConfig, context: RequestContext): string | null {
    // Check for sticky session
    if (context.user_session) {
      const stickyInstance = this.sessionAffinities.get(context.user_session);
      if (stickyInstance && this.isInstanceHealthy(stickyInstance, config.function_name)) {
        this.updateConnectionCount(stickyInstance, 1);
        return stickyInstance;
      }
    }

    // Get target from auto-recovery system
    const targetEndpoint = autoRecoverySystem.getLoadBalancingTarget(config.function_name);
    
    if (targetEndpoint) {
      // Update session affinity if needed
      if (context.user_session) {
        this.sessionAffinities.set(context.user_session, targetEndpoint);
      }
      
      this.updateConnectionCount(targetEndpoint, 1);
      return targetEndpoint;
    }

    return null;
  }

  /**
   * Forward request to target instance
   */
  private async forwardRequest(
    request: NextRequest,
    targetEndpoint: string,
    config: LoadBalancerConfig,
    context: RequestContext
  ): Promise<NextResponse> {
    const url = new URL(request.url);
    const targetUrl = `${url.protocol}//${url.host}${targetEndpoint}${url.pathname.replace(config.base_path, '')}${url.search}`;

    const headers = new Headers(request.headers);
    headers.set('X-Request-ID', context.request_id);
    headers.set('X-Forwarded-For', this.getClientIP(request));
    headers.set('X-Load-Balancer', 'true');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Create response with load balancer headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-Request-ID', context.request_id);
      responseHeaders.set('X-Target-Instance', targetEndpoint);
      responseHeaders.set('X-Retry-Count', context.retry_count.toString());

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute fallback request
   */
  private async executeFallback(
    request: NextRequest,
    config: LoadBalancerConfig,
    context: RequestContext
  ): Promise<NextResponse> {
    if (!config.fallback_endpoint) {
      throw new Error('No fallback endpoint configured');
    }

    try {
      return await this.forwardRequest(request, config.fallback_endpoint, config, context);
    } catch (error) {
      return new NextResponse(
        JSON.stringify({
          error: 'Service temporarily unavailable - fallback failed',
          request_id: context.request_id
        }),
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  /**
   * Check if instance is healthy
   */
  private isInstanceHealthy(endpoint: string, functionName: string): boolean {
    const instances = autoRecoverySystem.getFunctionInstances(functionName);
    const instance = instances.find(i => i.endpoint === endpoint);
    
    return instance ? 
      instance.status === 'active' && instance.health.status === 'healthy' :
      false;
  }

  /**
   * Update connection count for an instance
   */
  private updateConnectionCount(endpoint: string, delta: number): void {
    // This would update the connection count in the auto-recovery system
    // For now, we'll just log it
    console.log(`Connection count update for ${endpoint}: ${delta > 0 ? '+' : ''}${delta}`);
  }

  /**
   * Record request metrics
   */
  private recordRequestMetrics(
    context: RequestContext,
    statusCode: number,
    responseTime: number,
    error?: Error
  ): void {
    const metrics = {
      timestamp: new Date(),
      function_name: context.function_name,
      invocation_count: 1,
      avg_response_time: responseTime,
      error_count: statusCode >= 400 ? 1 : 0,
      memory_peak: process.memoryUsage().heapUsed,
      cpu_peak: process.cpuUsage().user
    };

    healthMonitor.recordMetrics(context.function_name, metrics);

    // Log request details
    console.log(`Request ${context.request_id}: ${context.function_name} -> ${statusCode} (${responseTime}ms)`);
    
    if (error) {
      console.error(`Request ${context.request_id} error:`, error.message);
    }
  }

  /**
   * Check if error is retryable
   */
  private shouldRetry(error: Error): boolean {
    // Retry on network errors, timeouts, and 5xx responses
    return (
      error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503') ||
      error.message.includes('504')
    );
  }

  /**
   * Extract session ID from request
   */
  private extractSessionId(request: NextRequest, config: LoadBalancerConfig): string | undefined {
    if (!config.sticky_session_cookie) return undefined;

    const cookies = request.cookies;
    return cookies.get(config.sticky_session_cookie)?.value;
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return 'unknown';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get active request count
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get active requests for a function
   */
  getActiveRequestsForFunction(functionName: string): RequestContext[] {
    return Array.from(this.activeRequests.values())
      .filter(ctx => ctx.function_name === functionName);
  }

  /**
   * Get session affinities
   */
  getSessionAffinities(): Map<string, string> {
    return new Map(this.sessionAffinities);
  }

  /**
   * Clear session affinity
   */
  clearSessionAffinity(sessionId: string): void {
    this.sessionAffinities.delete(sessionId);
  }

  /**
   * Clear all session affinities
   */
  clearAllSessionAffinities(): void {
    this.sessionAffinities.clear();
  }
}

// Singleton instance
export const loadBalancer = new LoadBalancer();

// Helper function to create load balancer middleware
export function createLoadBalancerMiddleware(config: LoadBalancerConfig) {
  return async (request: NextRequest): Promise<NextResponse> => {
    return await loadBalancer.routeRequest(request, config);
  };
}

// Default configurations for different function types
export const defaultLoadBalancerConfigs: Record<string, LoadBalancerConfig> = {
  admin: {
    function_name: 'admin',
    base_path: '/api/admin',
    timeout: 30000, // 30 seconds
    retry_attempts: 2,
    sticky_session_cookie: 'admin_session'
  },
  public: {
    function_name: 'public',
    base_path: '/api/public',
    timeout: 10000, // 10 seconds
    retry_attempts: 3,
    sticky_session_cookie: undefined // No sticky sessions for public
  },
  attempts: {
    function_name: 'attempts',
    base_path: '/api/attempts',
    timeout: 20000, // 20 seconds
    retry_attempts: 1, // Fewer retries for attempt operations
    sticky_session_cookie: 'attempt_session'
  }
};