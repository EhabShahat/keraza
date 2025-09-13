/**
 * Unified API Infrastructure
 * 
 * This module provides a comprehensive framework for building consolidated
 * API handlers with built-in authentication, error handling, monitoring,
 * and performance optimization.
 */

// Core handler and types
export {
  UnifiedAPIHandler,
  type APIRequest,
  type APIResponse,
  type AuthenticatedUser,
  type RouteHandler,
  type Middleware,
  type CacheConfig,
  type InvalidationRule
} from './unified-handler';

// Request utilities
export {
  validateRequestBody,
  parseQueryParams,
  extractPathParams,
  sanitizeInput,
  parsePagination,
  parseSort,
  createResponse,
  createErrorResponse,
  createPaginatedResponse,
  type ValidationRule,
  type ValidationResult,
  type PaginationParams,
  type SortParams
} from './request-utils';

// Middleware
export {
  createValidationMiddleware,
  sanitizationMiddleware,
  loggingMiddleware,
  createRateLimitMiddleware,
  createCorsMiddleware,
  createContentTypeMiddleware,
  createSizeLimitMiddleware,
  createCacheMiddleware,
  securityHeadersMiddleware,
  createTimeoutMiddleware,
  auditMiddleware,
  commonMiddleware,
  adminMiddleware,
  publicMiddleware
} from './middleware';

// Authentication
export {
  createAuthMiddleware,
  optionalAuthMiddleware,
  requiredAuthMiddleware,
  adminAuthMiddleware,
  createPermissionMiddleware,
  createRBACMiddleware,
  RoleBasedAccessControl,
  TokenValidator,
  SessionManager,
  clearUserPermissionCache,
  clearAllPermissionCache
} from './auth-middleware';

// Error handling
export {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  ErrorLogger,
  errorHandlingMiddleware,
  handleError,
  CircuitBreaker,
  circuitBreakers,
  GracefulDegradation,
  PerformanceMonitor,
  performanceMiddleware,
  type ErrorContext,
  type ErrorLog
} from './error-handler';

// Monitoring
export {
  MetricsCollector,
  AlertManager,
  createMonitoringMiddleware,
  setupDefaultHealthChecks,
  type MetricData,
  type HealthCheck,
  type SystemMetrics
} from './monitoring';

/**
 * Quick start example:
 * 
 * ```typescript
 * import { UnifiedAPIHandler, adminMiddleware, createValidationMiddleware } from '@/lib/api';
 * 
 * const handler = new UnifiedAPIHandler();
 * 
 * // Add a route
 * handler.addRoute({
 *   path: 'exams',
 *   method: 'GET',
 *   handler: async (request) => {
 *     // Your logic here
 *     return { data: [] };
 *   },
 *   middleware: adminMiddleware,
 *   requireAdmin: true
 * });
 * 
 * // Export for Next.js
 * export const GET = (req: NextRequest, context: any) => handler.handle(req, context);
 * ```
 */