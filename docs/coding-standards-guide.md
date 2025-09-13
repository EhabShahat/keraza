# Coding Standards and Best Practices Guide

## Overview

This guide establishes coding standards, best practices, and architectural patterns for the consolidated function architecture. Following these standards ensures maintainable, performant, and secure code across the entire system.

## Code Organization Standards

### File Structure and Naming

#### Directory Structure
```
src/
├── app/
│   └── api/
│       ├── admin/route.ts           # Admin consolidated handler
│       ├── public/route.ts          # Public consolidated handler
│       ├── attempts/[id]/route.ts   # Attempt consolidated handler
│       └── cache/route.ts           # Cache consolidated handler
├── lib/
│   ├── handlers/                    # Business logic handlers
│   │   ├── base-handler.ts          # Abstract base class
│   │   ├── exam-handler.ts          # Exam operations
│   │   ├── student-handler.ts       # Student operations
│   │   └── results-handler.ts       # Results operations
│   ├── middleware/                  # Cross-cutting concerns
│   │   ├── auth.ts                  # Authentication
│   │   ├── validation.ts            # Input validation
│   │   ├── rate-limiting.ts         # Rate limiting
│   │   └── audit-logging.ts         # Audit logging
│   ├── database/                    # Database layer
│   │   ├── query-optimizer.ts       # Query optimization
│   │   ├── connection-pool.ts       # Connection management
│   │   └── rpc-client.ts           # RPC function client
│   ├── cache/                       # Caching layer
│   │   ├── cache-manager.ts         # Cache abstraction
│   │   ├── strategies.ts            # Caching strategies
│   │   └── invalidation.ts          # Cache invalidation
│   └── utils/                       # Utility functions
│       ├── validation.ts            # Validation helpers
│       ├── error-handling.ts        # Error utilities
│       └── performance.ts           # Performance utilities
```

#### Naming Conventions

```typescript
// Files: kebab-case
exam-handler.ts
student-management.ts
cache-invalidation.ts

// Classes: PascalCase
class ExamHandler extends BaseHandler { }
class CacheManager { }
class QueryOptimizer { }

// Interfaces: PascalCase with descriptive names
interface ExamCreateRequest { }
interface CacheConfiguration { }
interface DatabaseConnection { }

// Functions and methods: camelCase
async createExam(data: ExamCreateRequest) { }
async invalidateCache(keys: string[]) { }
async optimizeQuery(query: string) { }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_CACHE_TTL = 300;
const DATABASE_TIMEOUT = 30000;

// Environment variables: UPPER_SNAKE_CASE
process.env.DATABASE_URL
process.env.CACHE_REDIS_URL
process.env.JWT_SECRET

// Cache keys: lowercase with colons
const CACHE_KEYS = {
  EXAM_INFO: (id: string) => `exam:${id}:info`,
  STUDENT_LIST: (page: number) => `students:list:${page}`,
  ACTIVE_EXAMS: 'exams:active:list'
};
```

## TypeScript Standards

### Type Definitions

#### Request/Response Types
```typescript
// Request types: Descriptive and specific
interface ExamCreateRequest {
  title: string;
  description?: string;
  duration: number; // in seconds
  settings: ExamSettings;
  questions: QuestionData[];
}

interface ExamUpdateRequest {
  id: string;
  title?: string;
  description?: string;
  duration?: number;
  settings?: Partial<ExamSettings>;
}

// Response types: Consistent structure
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  request_id?: string;
}

interface ResponseMeta {
  pagination?: PaginationInfo;
  performance?: PerformanceInfo;
  cache?: CacheInfo;
}
```

#### Database Types
```typescript
// Database entity types
interface ExamEntity {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  status: ExamStatus;
  settings: ExamSettings;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

// Enum types for better type safety
enum ExamStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  MULTIPLE_SELECT = 'multiple_select',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer',
  PARAGRAPH = 'paragraph'
}
```

#### Utility Types
```typescript
// Utility types for common patterns
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Cache-related types
interface CacheOptions {
  ttl?: number;
  tags?: string[];
  namespace?: string;
}

interface CacheEntry<T> {
  value: T;
  expires: number;
  tags: string[];
  created: number;
  accessed: number;
}

// Handler context type
interface HandlerContext {
  user?: AuthenticatedUser;
  requestId: string;
  startTime: number;
  db: DatabaseClient;
  cache: CacheManager;
  logger: Logger;
}
```

### Generic Patterns

```typescript
// Generic handler pattern
abstract class BaseHandler<TContext = HandlerContext> {
  protected context: TContext;
  
  constructor(protected resourceName: string) {}
  
  abstract execute(action: string, request: Request): Promise<Response>;
  
  protected async validateInput<T>(
    request: Request, 
    schema: z.ZodSchema<T>
  ): Promise<T> {
    // Implementation
  }
  
  protected successResponse<T>(data: T, meta?: ResponseMeta): Response {
    // Implementation
  }
  
  protected errorResponse(
    message: string, 
    status: number = 500, 
    code?: string
  ): Response {
    // Implementation
  }
}

// Generic cache pattern
class CacheManager<T = any> {
  async get<K extends T>(key: string): Promise<K | null> {
    // Implementation
  }
  
  async set<K extends T>(
    key: string, 
    value: K, 
    options?: CacheOptions
  ): Promise<void> {
    // Implementation
  }
  
  async invalidate(pattern: string | string[]): Promise<void> {
    // Implementation
  }
}
```

## Handler Implementation Standards

### Base Handler Pattern

```typescript
// Abstract base handler with common functionality
abstract class BaseHandler {
  protected db: DatabaseClient;
  protected cache: CacheManager;
  protected logger: Logger;
  protected context: HandlerContext;
  
  constructor(protected resourceName: string) {
    this.db = getDatabaseClient();
    this.cache = getCacheManager();
    this.logger = getLogger(resourceName);
  }
  
  // Main execution method - must be implemented by subclasses
  abstract execute(action: string, request: Request): Promise<Response>;
  
  // Common validation method
  protected async validateInput<T>(
    request: Request,
    schema: z.ZodSchema<T>
  ): Promise<T> {
    try {
      const body = await request.json();
      return schema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid input data', error.errors);
      }
      throw error;
    }
  }
  
  // Standardized response methods
  protected successResponse<T>(
    data: T, 
    meta?: ResponseMeta
  ): Response {
    return new Response(JSON.stringify({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        request_id: this.context.requestId,
        ...meta
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  protected errorResponse(
    message: string,
    status: number = 500,
    code?: string,
    details?: any
  ): Response {
    const error: ApiError = {
      code: code || this.getErrorCodeFromStatus(status),
      message,
      details,
      timestamp: new Date().toISOString(),
      request_id: this.context.requestId
    };
    
    // Log error for monitoring
    this.logger.error('Handler error', { error, context: this.context });
    
    return new Response(JSON.stringify({
      success: false,
      error
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Cache helper methods
  protected async getCachedData<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try cache first
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch fresh data
    const data = await fetcher();
    
    // Cache the result
    await this.cache.set(key, data, options);
    
    return data;
  }
  
  protected async invalidateRelatedCaches(tags: string[]): Promise<void> {
    await this.cache.invalidateTags(tags);
  }
  
  // Audit logging helper
  protected async auditLog(
    action: string,
    details?: any
  ): Promise<void> {
    await this.db.query(`
      INSERT INTO audit_logs (action, resource_type, resource_id, user_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      action,
      this.resourceName,
      details?.id || null,
      this.context.user?.id || null,
      details,
      this.context.request?.headers.get('x-forwarded-for') || 'unknown'
    ]);
  }
  
  private getErrorCodeFromStatus(status: number): string {
    const statusMap: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR'
    };
    
    return statusMap[status] || 'UNKNOWN_ERROR';
  }
}
```

### Concrete Handler Implementation

```typescript
// Example concrete handler following standards
export class ExamHandler extends BaseHandler {
  constructor() {
    super('exam');
  }
  
  // Validation schemas
  private schemas = {
    create: z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      duration: z.number().min(60).max(14400), // 1 minute to 4 hours
      settings: z.object({
        randomize_questions: z.boolean().default(false),
        show_results: z.boolean().default(true),
        allow_review: z.boolean().default(false)
      }).default({}),
      questions: z.array(z.object({
        type: z.nativeEnum(QuestionType),
        question: z.string().min(1),
        options: z.array(z.string()).optional(),
        correct_answers: z.array(z.string()).min(1)
      })).min(1)
    }),
    
    update: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      duration: z.number().min(60).max(14400).optional(),
      settings: z.object({
        randomize_questions: z.boolean(),
        show_results: z.boolean(),
        allow_review: z.boolean()
      }).partial().optional()
    })
  };
  
  async execute(action: string, request: Request): Promise<Response> {
    // Route to appropriate method based on action
    switch (action) {
      case 'create':
        return this.create(request);
      case 'list':
        return this.list(request);
      case 'get':
        return this.get(request);
      case 'update':
        return this.update(request);
      case 'delete':
        return this.delete(request);
      case 'publish':
        return this.publish(request);
      case 'archive':
        return this.archive(request);
      default:
        return this.errorResponse(`Unknown action: ${action}`, 400);
    }
  }
  
  private async create(request: Request): Promise<Response> {
    // Validate input
    const data = await this.validateInput(request, this.schemas.create);
    
    // Check permissions
    if (!this.context.user?.permissions.includes('exam:create')) {
      return this.errorResponse('Insufficient permissions', 403);
    }
    
    try {
      // Start database transaction
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');
        
        // Create exam
        const examResult = await client.query(`
          INSERT INTO exams (title, description, duration, settings, status, created_by)
          VALUES ($1, $2, $3, $4, 'draft', $5)
          RETURNING *
        `, [data.title, data.description, data.duration, data.settings, this.context.user.id]);
        
        const exam = examResult.rows[0];
        
        // Create questions
        for (const [index, question] of data.questions.entries()) {
          await client.query(`
            INSERT INTO questions (exam_id, type, question, options, correct_answers, order_index)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [exam.id, question.type, question.question, question.options, question.correct_answers, index]);
        }
        
        await client.query('COMMIT');
        
        // Invalidate related caches
        await this.invalidateRelatedCaches(['exams', 'exam_list']);
        
        // Audit log
        await this.auditLog('exam_created', { 
          id: exam.id, 
          title: exam.title,
          question_count: data.questions.length 
        });
        
        return this.successResponse(exam);
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      this.logger.error('Failed to create exam', { error, data });
      return this.errorResponse('Failed to create exam', 500);
    }
  }
  
  private async list(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    
    // Build cache key
    const cacheKey = `exams:list:${page}:${limit}:${status}:${search}`;
    
    return this.getCachedData(cacheKey, async () => {
      // Build query conditions
      const conditions = [];
      const params = [limit, (page - 1) * limit];
      let paramIndex = 3;
      
      if (status !== 'all') {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }
      
      if (search) {
        conditions.push(`(title ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`);
        params.push(`%${search}%`, `%${search}%`);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Execute query with total count
      const result = await this.db.query(`
        SELECT 
          e.*,
          COUNT(*) OVER() as total_count,
          COUNT(q.id) as question_count,
          COUNT(ea.id) as attempt_count
        FROM exams e
        LEFT JOIN questions q ON q.exam_id = e.id
        LEFT JOIN exam_attempts ea ON ea.exam_id = e.id
        ${whereClause}
        GROUP BY e.id
        ORDER BY e.created_at DESC
        LIMIT $1 OFFSET $2
      `, params);
      
      const exams = result.rows;
      const totalCount = exams[0]?.total_count || 0;
      
      return {
        exams: exams.map(exam => ({
          ...exam,
          total_count: undefined // Remove from individual items
        })),
        pagination: {
          page,
          limit,
          total: parseInt(totalCount),
          pages: Math.ceil(totalCount / limit)
        }
      };
    }, {
      ttl: 300, // 5 minutes
      tags: ['exams', 'exam_list']
    });
  }
  
  // Additional methods following the same pattern...
}
```

## Database Standards

### Query Optimization

```typescript
// Query optimization patterns
class QueryOptimizer {
  
  // Use prepared statements for frequently executed queries
  private preparedQueries = new Map<string, string>();
  
  async optimizeQuery(options: {
    name: string;
    query: string;
    parameters?: any[];
    cacheKey?: string;
    cacheTTL?: number;
  }) {
    // Register prepared statement
    if (!this.preparedQueries.has(options.name)) {
      this.preparedQueries.set(options.name, options.query);
    }
    
    // Use caching if specified
    if (options.cacheKey) {
      return this.getCachedQuery(options);
    }
    
    return this.executeQuery(options.query, options.parameters);
  }
  
  // Batch operations for efficiency
  async executeBatch(operations: Array<{
    query: string;
    parameters: any[];
  }>) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const op of operations) {
        const result = await client.query(op.query, op.parameters);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Connection pooling best practices
  async withConnection<T>(operation: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    
    try {
      return await operation(client);
    } finally {
      client.release();
    }
  }
}
```

### Index Strategy

```sql
-- Performance indexes following naming conventions
CREATE INDEX CONCURRENTLY idx_exams_status_created 
ON exams(status, created_at DESC) 
WHERE status IN ('active', 'published');

CREATE INDEX CONCURRENTLY idx_exam_attempts_exam_student 
ON exam_attempts(exam_id, student_id, status) 
WHERE status IN ('in_progress', 'completed');

CREATE INDEX CONCURRENTLY idx_questions_exam_order 
ON questions(exam_id, order_index);

-- Partial indexes for specific use cases
CREATE INDEX CONCURRENTLY idx_audit_logs_recent 
ON audit_logs(created_at, action) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY idx_students_exam_code 
ON students(exam_id, code) 
WHERE active = true;
```

## Caching Standards

### Cache Key Patterns

```typescript
// Standardized cache key patterns
const CACHE_PATTERNS = {
  // Entity patterns
  ENTITY: (type: string, id: string) => `${type}:${id}`,
  ENTITY_FIELD: (type: string, id: string, field: string) => `${type}:${id}:${field}`,
  
  // List patterns
  LIST: (type: string, filters?: string) => filters ? `${type}:list:${filters}` : `${type}:list`,
  PAGINATED_LIST: (type: string, page: number, limit: number, filters?: string) => 
    `${type}:list:${page}:${limit}${filters ? `:${filters}` : ''}`,
  
  // Search patterns
  SEARCH: (type: string, query: string, page?: number) => 
    `${type}:search:${encodeURIComponent(query)}${page ? `:${page}` : ''}`,
  
  // Aggregation patterns
  COUNT: (type: string, filters?: string) => `${type}:count${filters ? `:${filters}` : ''}`,
  STATS: (type: string, period?: string) => `${type}:stats${period ? `:${period}` : ''}`,
  
  // User-specific patterns
  USER_DATA: (userId: string, type: string) => `user:${userId}:${type}`,
  USER_PERMISSIONS: (userId: string) => `user:${userId}:permissions`,
  
  // Session patterns
  SESSION: (sessionId: string) => `session:${sessionId}`,
  AUTH_TOKEN: (tokenId: string) => `auth:${tokenId}`
};

// Usage examples
const examInfoKey = CACHE_PATTERNS.ENTITY('exam', examId);
const examQuestionsKey = CACHE_PATTERNS.ENTITY_FIELD('exam', examId, 'questions');
const examListKey = CACHE_PATTERNS.PAGINATED_LIST('exam', page, limit, `status:active`);
const userPermissionsKey = CACHE_PATTERNS.USER_PERMISSIONS(userId);
```

### Cache Strategy Implementation

```typescript
// Cache strategy based on data characteristics
enum CacheStrategy {
  STATIC = 'static',           // Rarely changes (24h TTL)
  SEMI_STATIC = 'semi_static', // Changes occasionally (1h TTL)
  DYNAMIC = 'dynamic',         // Changes frequently (5m TTL)
  REAL_TIME = 'real_time'      // Changes constantly (1m TTL)
}

const CACHE_CONFIGS: Record<CacheStrategy, CacheOptions> = {
  [CacheStrategy.STATIC]: {
    ttl: 86400,  // 24 hours
    tags: ['static']
  },
  [CacheStrategy.SEMI_STATIC]: {
    ttl: 3600,   // 1 hour
    tags: ['semi_static']
  },
  [CacheStrategy.DYNAMIC]: {
    ttl: 300,    // 5 minutes
    tags: ['dynamic']
  },
  [CacheStrategy.REAL_TIME]: {
    ttl: 60,     // 1 minute
    tags: ['real_time']
  }
};

// Cache manager with strategy support
class StrategicCacheManager extends CacheManager {
  
  async setWithStrategy<T>(
    key: string,
    value: T,
    strategy: CacheStrategy,
    additionalTags: string[] = []
  ): Promise<void> {
    const config = CACHE_CONFIGS[strategy];
    const tags = [...config.tags, ...additionalTags];
    
    await this.set(key, value, { ...config, tags });
  }
  
  async getWithFallback<T>(
    key: string,
    fallback: () => Promise<T>,
    strategy: CacheStrategy,
    tags: string[] = []
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const value = await fallback();
    await this.setWithStrategy(key, value, strategy, tags);
    
    return value;
  }
}
```

## Error Handling Standards

### Error Classification

```typescript
// Custom error classes for different error types
export class ValidationError extends Error {
  constructor(
    message: string,
    public details: any[] = [],
    public field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string = 'Insufficient permissions',
    public requiredPermission?: string
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(
    resource: string,
    identifier?: string
  ) {
    super(`${resource}${identifier ? ` with id ${identifier}` : ''} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(
    message: string,
    public conflictingField?: string
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  constructor(
    public limit: number,
    public window: number,
    public retryAfter: number
  ) {
    super(`Rate limit exceeded: ${limit} requests per ${window} seconds`);
    this.name = 'RateLimitError';
  }
}
```

### Error Handling Middleware

```typescript
// Global error handling middleware
export class ErrorHandler {
  
  static handle(error: Error, context: HandlerContext): Response {
    // Log error for monitoring
    context.logger.error('Handler error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context: {
        requestId: context.requestId,
        userId: context.user?.id,
        resource: context.resource,
        action: context.action
      }
    });
    
    // Handle specific error types
    if (error instanceof ValidationError) {
      return this.validationErrorResponse(error, context);
    }
    
    if (error instanceof AuthenticationError) {
      return this.authenticationErrorResponse(error, context);
    }
    
    if (error instanceof AuthorizationError) {
      return this.authorizationErrorResponse(error, context);
    }
    
    if (error instanceof NotFoundError) {
      return this.notFoundErrorResponse(error, context);
    }
    
    if (error instanceof ConflictError) {
      return this.conflictErrorResponse(error, context);
    }
    
    if (error instanceof RateLimitError) {
      return this.rateLimitErrorResponse(error, context);
    }
    
    // Default to internal server error
    return this.internalErrorResponse(error, context);
  }
  
  private static validationErrorResponse(
    error: ValidationError, 
    context: HandlerContext
  ): Response {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
        field: error.field,
        timestamp: new Date().toISOString(),
        request_id: context.requestId
      }
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private static authenticationErrorResponse(
    error: AuthenticationError,
    context: HandlerContext
  ): Response {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
        request_id: context.requestId
      }
    }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer'
      }
    });
  }
  
  private static rateLimitErrorResponse(
    error: RateLimitError,
    context: HandlerContext
  ): Response {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: error.message,
        details: {
          limit: error.limit,
          window: error.window,
          retry_after: error.retryAfter
        },
        timestamp: new Date().toISOString(),
        request_id: context.requestId
      }
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': error.retryAfter.toString(),
        'X-RateLimit-Limit': error.limit.toString(),
        'X-RateLimit-Window': error.window.toString()
      }
    });
  }
  
  // Additional error response methods...
}
```

## Security Standards

### Input Validation

```typescript
// Comprehensive input validation using Zod
import { z } from 'zod';

// Common validation schemas
const CommonSchemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number, and special character'),
  
  pagination: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20)
  }),
  
  dateRange: z.object({
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }).refine(data => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  }, 'End date must be after start date'),
  
  searchQuery: z.object({
    q: z.string().min(1).max(100),
    filters: z.record(z.string()).optional()
  })
};

// Sanitization helpers
class InputSanitizer {
  
  static sanitizeHtml(input: string): string {
    // Remove potentially dangerous HTML tags and attributes
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  }
  
  static sanitizeFilename(filename: string): string {
    // Remove path traversal and dangerous characters
    return filename
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\.\./g, '')
      .substring(0, 255);
  }
  
  static sanitizeSqlIdentifier(identifier: string): string {
    // Only allow alphanumeric characters and underscores
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  }
}
```

### Authentication and Authorization

```typescript
// JWT token validation and user context
class AuthenticationService {
  
  async validateToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      
      // Check token expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return null;
      }
      
      // Get user from cache or database
      const user = await this.getUserById(payload.sub);
      if (!user || !user.active) {
        return null;
      }
      
      return user;
      
    } catch (error) {
      return null;
    }
  }
  
  async checkPermission(
    user: AuthenticatedUser, 
    permission: string
  ): Promise<boolean> {
    // Check cached permissions first
    const cacheKey = `user:${user.id}:permissions`;
    let permissions = await this.cache.get<string[]>(cacheKey);
    
    if (!permissions) {
      // Fetch from database
      const result = await this.db.query(
        'SELECT permissions FROM admin_users WHERE id = $1',
        [user.id]
      );
      
      permissions = result.rows[0]?.permissions || [];
      
      // Cache for 1 hour
      await this.cache.set(cacheKey, permissions, { ttl: 3600 });
    }
    
    return permissions.includes(permission) || permissions.includes('*');
  }
}

// Authorization middleware
const requirePermission = (permission: string) => {
  return async (context: HandlerContext) => {
    if (!context.user) {
      throw new AuthenticationError();
    }
    
    const hasPermission = await authService.checkPermission(context.user, permission);
    if (!hasPermission) {
      throw new AuthorizationError(`Required permission: ${permission}`, permission);
    }
    
    return context;
  };
};
```

## Performance Standards

### Response Time Targets

```typescript
// Performance monitoring and alerting
class PerformanceMonitor {
  
  private static readonly PERFORMANCE_TARGETS = {
    API_RESPONSE_TIME: 500,      // 500ms
    DATABASE_QUERY_TIME: 100,    // 100ms
    CACHE_OPERATION_TIME: 10,    // 10ms
    FUNCTION_COLD_START: 1000    // 1 second
  };
  
  async measureOperation<T>(
    name: string,
    operation: () => Promise<T>,
    target?: number
  ): Promise<T> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const result = await operation();
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage().heapUsed;
      
      const duration = Number(endTime - startTime) / 1000000; // Convert to ms
      const memoryDelta = endMemory - startMemory;
      
      // Log performance metrics
      console.log(`Performance [${name}]:`, {
        duration: `${duration.toFixed(2)}ms`,
        memoryDelta: `${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
        target: target ? `${target}ms` : 'N/A',
        exceeded: target ? duration > target : false
      });
      
      // Alert if target exceeded
      if (target && duration > target) {
        this.alertPerformanceIssue(name, duration, target);
      }
      
      return result;
      
    } catch (error) {
      console.error(`Performance [${name}] - Error:`, error.message);
      throw error;
    }
  }
  
  private alertPerformanceIssue(
    operation: string, 
    actual: number, 
    target: number
  ): void {
    // Send alert to monitoring system
    console.warn(`Performance alert: ${operation} took ${actual.toFixed(2)}ms (target: ${target}ms)`);
  }
}
```

This comprehensive coding standards guide ensures consistent, maintainable, and high-quality code across the consolidated function architecture.