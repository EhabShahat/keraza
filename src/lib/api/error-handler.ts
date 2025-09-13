import { APIRequest, APIResponse, Middleware } from "./unified-handler";

/**
 * Centralized error handling and monitoring infrastructure
 */

export interface ErrorContext {
  request: APIRequest;
  timestamp: Date;
  errorId: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info';
  message: string;
  context: ErrorContext;
  resolved: boolean;
}

/**
 * Custom error classes
 */
export class APIError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly metadata?: Record<string, any>;

  constructor(message: string, status = 500, code = 'INTERNAL_ERROR', metadata?: Record<string, any>) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.metadata = metadata;
  }
}

export class ValidationError extends APIError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', metadata);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends APIError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends APIError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends APIError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 500, 'DATABASE_ERROR', metadata);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends APIError {
  constructor(service: string, message: string, metadata?: Record<string, any>) {
    super(`External service error (${service}): ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', metadata);
    this.name = 'ExternalServiceError';
  }
}

/**
 * Error logger
 */
export class ErrorLogger {
  private static logs: ErrorLog[] = [];
  private static maxLogs = 1000;

  /**
   * Log an error
   */
  static log(error: Error, context: Partial<ErrorContext>, level: 'error' | 'warn' | 'info' = 'error'): string {
    const errorId = this.generateErrorId();
    const timestamp = new Date();

    const errorLog: ErrorLog = {
      id: errorId,
      timestamp,
      level,
      message: error.message,
      context: {
        request: context.request!,
        timestamp,
        errorId,
        stack: error.stack,
        metadata: context.metadata
      },
      resolved: false
    };

    this.logs.push(errorLog);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${errorId}] ${error.message}`, {
        stack: error.stack,
        context: context.metadata
      });
    }

    return errorId;
  }

  /**
   * Get error logs
   */
  static getLogs(limit = 100): ErrorLog[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get error by ID
   */
  static getError(errorId: string): ErrorLog | undefined {
    return this.logs.find(log => log.id === errorId);
  }

  /**
   * Mark error as resolved
   */
  static resolveError(errorId: string): boolean {
    const error = this.logs.find(log => log.id === errorId);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Clear logs
   */
  static clearLogs(): void {
    this.logs = [];
  }

  /**
   * Generate unique error ID
   */
  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Error handling middleware
 */
export const errorHandlingMiddleware: Middleware = {
  name: 'error-handling',
  handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
    try {
      return request;
    } catch (error: any) {
      return handleError(error, request);
    }
  }
};

/**
 * Handle different types of errors
 */
export function handleError(error: any, request: APIRequest): APIResponse {
  // Log the error
  const errorId = ErrorLogger.log(error, { request });

  // Handle known error types
  if (error instanceof APIError) {
    return {
      error: error.message,
      status: error.status,
      headers: {
        'X-Error-ID': errorId,
        'X-Error-Code': error.code
      }
    };
  }

  // Handle Supabase errors
  if (error?.code && typeof error.code === 'string') {
    return handleDatabaseError(error, errorId);
  }

  // Handle validation errors
  if (error.name === 'ValidationError' || error.message?.includes('validation')) {
    return {
      error: error.message || 'Validation failed',
      status: 400,
      headers: { 'X-Error-ID': errorId }
    };
  }

  // Handle timeout errors
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return {
      error: 'Request timeout',
      status: 408,
      headers: { 'X-Error-ID': errorId }
    };
  }

  // Default error response
  return {
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    status: 500,
    headers: { 'X-Error-ID': errorId }
  };
}

/**
 * Handle database-specific errors
 */
function handleDatabaseError(error: any, errorId: string): APIResponse {
  const commonErrors: Record<string, { message: string; status: number }> = {
    '23505': { message: 'Resource already exists', status: 409 }, // Unique violation
    '23503': { message: 'Referenced resource not found', status: 400 }, // Foreign key violation
    '23502': { message: 'Required field missing', status: 400 }, // Not null violation
    '42703': { message: 'Invalid field specified', status: 400 }, // Undefined column
    '42P01': { message: 'Resource not found', status: 404 }, // Undefined table
    'PGRST116': { message: 'Resource not found', status: 404 }, // PostgREST not found
    'PGRST301': { message: 'Access denied', status: 403 } // PostgREST forbidden
  };

  const errorInfo = commonErrors[error.code];
  if (errorInfo) {
    return {
      error: errorInfo.message,
      status: errorInfo.status,
      headers: { 'X-Error-ID': errorId }
    };
  }

  return {
    error: 'Database operation failed',
    status: 500,
    headers: { 'X-Error-ID': errorId }
  };
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 1 minute
    private monitoringPeriod: number = 300000 // 5 minutes
  ) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new APIError('Service temporarily unavailable', 503, 'CIRCUIT_BREAKER_OPEN');
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a failure
   */
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Reset circuit breaker
   */
  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Global circuit breakers for different services
 */
export const circuitBreakers = {
  database: new CircuitBreaker(5, 60000),
  supabase: new CircuitBreaker(3, 30000),
  external: new CircuitBreaker(10, 120000)
};

/**
 * Graceful degradation utilities
 */
export class GracefulDegradation {
  /**
   * Execute with fallback
   */
  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T> | T,
    circuitBreaker?: CircuitBreaker
  ): Promise<T> {
    try {
      if (circuitBreaker) {
        return await circuitBreaker.execute(primary);
      }
      return await primary();
    } catch (error) {
      console.warn('Primary operation failed, using fallback:', error);
      return await fallback();
    }
  }

  /**
   * Execute with cached fallback
   */
  static async withCachedFallback<T>(
    operation: () => Promise<T>,
    cacheKey: string,
    cache: Map<string, { data: T; expires: number }>
  ): Promise<T> {
    try {
      const result = await operation();
      
      // Cache successful result
      cache.set(cacheKey, {
        data: result,
        expires: Date.now() + 300000 // 5 minutes
      });
      
      return result;
    } catch (error) {
      // Try to return cached data
      const cached = cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        console.warn('Operation failed, returning cached data:', error);
        return cached.data;
      }
      
      throw error;
    }
  }
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  /**
   * Record execution time
   */
  static recordExecutionTime(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const times = this.metrics.get(operation)!;
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  /**
   * Get performance statistics
   */
  static getStats(operation: string): { avg: number; min: number; max: number; count: number } | null {
    const times = this.metrics.get(operation);
    if (!times || times.length === 0) {
      return null;
    }

    return {
      avg: times.reduce((sum, time) => sum + time, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      count: times.length
    };
  }

  /**
   * Get all performance metrics
   */
  static getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [operation, times] of this.metrics.entries()) {
      if (times.length > 0) {
        stats[operation] = {
          avg: times.reduce((sum, time) => sum + time, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          count: times.length
        };
      }
    }
    
    return stats;
  }

  /**
   * Clear metrics
   */
  static clearMetrics(): void {
    this.metrics.clear();
  }
}

/**
 * Performance monitoring middleware
 */
export const performanceMiddleware: Middleware = {
  name: 'performance',
  handler: async (request: APIRequest): Promise<APIRequest> => {
    const startTime = Date.now();
    const operation = `${request.method} /${request.path.join('/')}`;
    
    // Add cleanup function to request context
    (request as any).recordPerformance = () => {
      const duration = Date.now() - startTime;
      PerformanceMonitor.recordExecutionTime(operation, duration);
    };
    
    return request;
  }
};