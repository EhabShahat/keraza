# Performance Tuning Guide

## Overview

This guide provides comprehensive performance optimization strategies for the consolidated function architecture, covering function optimization, database tuning, cache optimization, and system-wide performance improvements.

## Performance Baseline Metrics

### Target Performance Goals

| Metric | Target | Current | Improvement |
|--------|--------|---------|-------------|
| API Response Time | < 200ms | 350ms | 43% faster |
| Function Cold Start | < 500ms | 1200ms | 58% faster |
| Database Query Time | < 50ms | 120ms | 58% faster |
| Cache Hit Rate | > 90% | 75% | 20% improvement |
| Error Rate | < 0.1% | 0.3% | 67% reduction |
| Memory Usage | < 70% | 85% | 18% reduction |

### Performance Monitoring Setup

```javascript
// Performance monitoring configuration
const performanceConfig = {
  metrics: {
    response_time: {
      target: 200,
      warning: 500,
      critical: 1000
    },
    error_rate: {
      target: 0.001,
      warning: 0.01,
      critical: 0.05
    },
    memory_usage: {
      target: 0.7,
      warning: 0.8,
      critical: 0.9
    },
    cache_hit_rate: {
      target: 0.9,
      warning: 0.8,
      critical: 0.7
    }
  },
  collection_interval: 10000, // 10 seconds
  retention_period: 2592000   // 30 days
};
```

## Function Optimization

### Bundle Size Optimization

#### 1. Dynamic Imports for Large Dependencies

```javascript
// Before: Large bundle with all dependencies loaded upfront
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Parser } from 'json2csv';

// After: Dynamic imports for conditional loading
const generatePDF = async (data) => {
  const { jsPDF } = await import('jspdf');
  return new jsPDF().text(data, 10, 10);
};

const exportToExcel = async (data) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
};

const exportToCSV = async (data) => {
  const { Parser } = await import('json2csv');
  const parser = new Parser();
  return parser.parse(data);
};
```

#### 2. Tree Shaking Optimization

```javascript
// Before: Importing entire lodash library
import _ from 'lodash';

// After: Import only needed functions
import { debounce, throttle, groupBy } from 'lodash-es';

// Or use native alternatives
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
```

#### 3. Code Splitting by Route

```javascript
// Implement route-based code splitting
const routeHandlers = {
  'exams': () => import('./handlers/exam-handler'),
  'students': () => import('./handlers/student-handler'),
  'results': () => import('./handlers/results-handler'),
  'monitoring': () => import('./handlers/monitoring-handler')
};

const getHandler = async (route) => {
  const handlerModule = await routeHandlers[route]();
  return handlerModule.default;
};
```

### Memory Optimization

#### 1. Connection Pooling

```javascript
// Optimized database connection pool
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Maximum connections
  min: 5,                     // Minimum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout for new connections
  acquireTimeoutMillis: 60000,   // Timeout for acquiring connection
  createTimeoutMillis: 8000,     // Timeout for creating connection
  destroyTimeoutMillis: 5000,    // Timeout for destroying connection
  reapIntervalMillis: 1000,      // Check for idle connections every 1s
  createRetryIntervalMillis: 200 // Retry connection creation every 200ms
});

// Connection health monitoring
pool.on('connect', (client) => {
  console.log('New client connected:', client.processID);
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});
```

#### 2. Memory Leak Prevention

```javascript
// Memory leak detection and prevention
class MemoryMonitor {
  constructor() {
    this.baseline = process.memoryUsage();
    this.samples = [];
    this.alertThreshold = 100 * 1024 * 1024; // 100MB
  }
  
  startMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      this.samples.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
        external: usage.external
      });
      
      // Keep only last 100 samples
      if (this.samples.length > 100) {
        this.samples.shift();
      }
      
      // Check for memory leaks
      this.detectLeaks(usage);
    }, 30000); // Check every 30 seconds
  }
  
  detectLeaks(currentUsage) {
    const growth = currentUsage.heapUsed - this.baseline.heapUsed;
    
    if (growth > this.alertThreshold) {
      console.warn('Potential memory leak detected:', {
        growth: Math.round(growth / 1024 / 1024) + 'MB',
        current: Math.round(currentUsage.heapUsed / 1024 / 1024) + 'MB',
        baseline: Math.round(this.baseline.heapUsed / 1024 / 1024) + 'MB'
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }
  
  getMemoryReport() {
    const current = process.memoryUsage();
    const trend = this.calculateTrend();
    
    return {
      current: {
        heapUsed: Math.round(current.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(current.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(current.rss / 1024 / 1024) + 'MB'
      },
      trend,
      samples: this.samples.length
    };
  }
  
  calculateTrend() {
    if (this.samples.length < 10) return 'insufficient_data';
    
    const recent = this.samples.slice(-10);
    const older = this.samples.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.heapUsed, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }
}

// Initialize memory monitoring
const memoryMonitor = new MemoryMonitor();
memoryMonitor.startMonitoring();
```

#### 3. Resource Cleanup

```javascript
// Comprehensive resource cleanup
class ResourceManager {
  constructor() {
    this.resources = new Set();
    this.cleanupHandlers = new Map();
  }
  
  register(resource, cleanupFn) {
    this.resources.add(resource);
    this.cleanupHandlers.set(resource, cleanupFn);
    
    return resource;
  }
  
  async cleanup(resource) {
    if (this.resources.has(resource)) {
      const cleanupFn = this.cleanupHandlers.get(resource);
      try {
        await cleanupFn();
      } catch (error) {
        console.error('Cleanup error:', error);
      } finally {
        this.resources.delete(resource);
        this.cleanupHandlers.delete(resource);
      }
    }
  }
  
  async cleanupAll() {
    const cleanupPromises = Array.from(this.resources).map(resource => 
      this.cleanup(resource)
    );
    
    await Promise.allSettled(cleanupPromises);
  }
}

// Usage in request handlers
const handleRequest = async (req, res) => {
  const resourceManager = new ResourceManager();
  
  try {
    // Register database connection
    const dbClient = await pool.connect();
    resourceManager.register(dbClient, () => dbClient.release());
    
    // Register cache connection
    const cacheClient = await getCacheClient();
    resourceManager.register(cacheClient, () => cacheClient.disconnect());
    
    // Register file handles
    const fileHandle = await fs.open('temp.txt', 'w');
    resourceManager.register(fileHandle, () => fileHandle.close());
    
    // Process request
    return await processRequest(req, res, { dbClient, cacheClient, fileHandle });
    
  } finally {
    // Cleanup all resources
    await resourceManager.cleanupAll();
  }
};
```

### Cold Start Optimization

#### 1. Connection Warming

```javascript
// Pre-warm connections and resources
let isWarm = false;
let warmupPromise = null;

const warmup = async () => {
  if (warmupPromise) return warmupPromise;
  
  warmupPromise = (async () => {
    try {
      // Pre-establish database connections
      await pool.query('SELECT 1');
      
      // Pre-warm cache connections
      await cache.get('warmup-key');
      
      // Pre-load configuration
      await loadConfiguration();
      
      // Pre-compile templates
      await compileTemplates();
      
      isWarm = true;
      console.log('Function warmed up successfully');
    } catch (error) {
      console.error('Warmup failed:', error);
      warmupPromise = null; // Allow retry
    }
  })();
  
  return warmupPromise;
};

// Handler with warmup
export const handler = async (event, context) => {
  const startTime = Date.now();
  
  // Warm up if needed (non-blocking for subsequent requests)
  if (!isWarm) {
    await warmup();
  }
  
  try {
    const result = await processRequest(event, context);
    
    // Log performance metrics
    const duration = Date.now() - startTime;
    console.log('Request completed:', {
      duration,
      coldStart: !isWarm,
      path: event.path
    });
    
    return result;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
};
```

#### 2. Keep-Warm Strategy

```javascript
// Implement keep-warm mechanism
const keepWarmConfig = {
  interval: 5 * 60 * 1000, // 5 minutes
  endpoints: [
    '/api/admin/health',
    '/api/public/system-status',
    '/api/attempts/health',
    '/api/cache/health'
  ]
};

const keepWarm = async () => {
  for (const endpoint of keepWarmConfig.endpoints) {
    try {
      const response = await fetch(`${process.env.SITE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'KeepWarm/1.0',
          'X-Keep-Warm': 'true'
        }
      });
      
      console.log(`Keep-warm ${endpoint}:`, response.status);
    } catch (error) {
      console.warn(`Keep-warm failed for ${endpoint}:`, error.message);
    }
  }
};

// Schedule keep-warm (in a separate function or cron job)
if (process.env.ENABLE_KEEP_WARM === 'true') {
  setInterval(keepWarm, keepWarmConfig.interval);
}
```

## Database Performance Optimization

### Query Optimization

#### 1. Index Strategy

```sql
-- Performance indexes for consolidated functions
CREATE INDEX CONCURRENTLY idx_exam_attempts_performance 
ON exam_attempts(exam_id, student_id, status, created_at) 
WHERE status IN ('in_progress', 'completed');

CREATE INDEX CONCURRENTLY idx_exam_attempts_monitoring 
ON exam_attempts(status, updated_at) 
WHERE status = 'in_progress';

CREATE INDEX CONCURRENTLY idx_students_lookup 
ON students(code, exam_id) 
WHERE active = true;

CREATE INDEX CONCURRENTLY idx_exams_active 
ON exams(status, created_at) 
WHERE status IN ('active', 'published');

-- Partial indexes for specific use cases
CREATE INDEX CONCURRENTLY idx_audit_logs_recent 
ON audit_logs(created_at, action) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY idx_exam_results_analysis 
ON exam_attempts(exam_id, score, completed_at) 
WHERE status = 'completed' AND score IS NOT NULL;
```

#### 2. Query Optimization Patterns

```javascript
// Optimized query patterns
class OptimizedQueries {
  
  // Use prepared statements for frequently executed queries
  static async getExamAttempts(examId, status = null) {
    const query = `
      SELECT ea.id, ea.student_id, ea.score, ea.completed_at,
             s.name, s.code
      FROM exam_attempts ea
      JOIN students s ON s.id = ea.student_id
      WHERE ea.exam_id = $1
      ${status ? 'AND ea.status = $2' : ''}
      ORDER BY ea.created_at DESC
    `;
    
    const params = status ? [examId, status] : [examId];
    return db.query(query, params);
  }
  
  // Batch operations to reduce round trips
  static async batchUpdateAttempts(updates) {
    const query = `
      UPDATE exam_attempts 
      SET score = data.score, 
          updated_at = NOW()
      FROM (VALUES ${updates.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(', ')}) 
      AS data(id, score)
      WHERE exam_attempts.id = data.id::uuid
    `;
    
    const params = updates.flatMap(u => [u.id, u.score]);
    return db.query(query, params);
  }
  
  // Use window functions for analytics
  static async getExamStatistics(examId) {
    const query = `
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_attempts,
        AVG(score) FILTER (WHERE status = 'completed') as average_score,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score) 
          FILTER (WHERE status = 'completed') as median_score,
        MIN(score) FILTER (WHERE status = 'completed') as min_score,
        MAX(score) FILTER (WHERE status = 'completed') as max_score,
        COUNT(*) FILTER (WHERE score >= 70) as passing_count
      FROM exam_attempts 
      WHERE exam_id = $1
    `;
    
    return db.query(query, [examId]);
  }
  
  // Efficient pagination with cursor-based approach
  static async getPaginatedResults(examId, cursor = null, limit = 50) {
    const query = `
      SELECT ea.id, ea.student_id, ea.score, ea.completed_at,
             s.name, s.code
      FROM exam_attempts ea
      JOIN students s ON s.id = ea.student_id
      WHERE ea.exam_id = $1
      ${cursor ? 'AND ea.id > $3' : ''}
      ORDER BY ea.id
      LIMIT $2
    `;
    
    const params = cursor ? [examId, limit, cursor] : [examId, limit];
    return db.query(query, params);
  }
}
```

#### 3. Connection Pool Optimization

```javascript
// Advanced connection pool configuration
const createOptimizedPool = () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    
    // Connection limits
    max: parseInt(process.env.DB_POOL_MAX) || 20,
    min: parseInt(process.env.DB_POOL_MIN) || 5,
    
    // Timeouts
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    acquireTimeoutMillis: 60000,
    
    // Health checks
    allowExitOnIdle: true,
    
    // SSL configuration
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
    
    // Statement timeout
    statement_timeout: 30000,
    query_timeout: 30000,
    
    // Application name for monitoring
    application_name: 'exam-app-consolidated'
  });
  
  // Pool monitoring
  pool.on('connect', (client) => {
    console.log('Database connection established:', {
      processID: client.processID,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount
    });
  });
  
  pool.on('acquire', (client) => {
    console.log('Connection acquired from pool:', {
      processID: client.processID,
      waitingCount: pool.waitingCount
    });
  });
  
  pool.on('error', (err, client) => {
    console.error('Database pool error:', err);
  });
  
  return pool;
};
```

### RPC Function Optimization

#### 1. Consolidated RPC Functions

```sql
-- Consolidated attempt operations RPC
CREATE OR REPLACE FUNCTION consolidated_attempt_operations(
  operation_type TEXT,
  attempt_data JSONB
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  CASE operation_type
    WHEN 'get_state' THEN
      SELECT jsonb_build_object(
        'attempt', row_to_json(ea),
        'exam', row_to_json(e),
        'student', row_to_json(s)
      ) INTO result
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      JOIN students s ON s.id = ea.student_id
      WHERE ea.id = (attempt_data->>'attempt_id')::uuid;
      
    WHEN 'save_progress' THEN
      UPDATE exam_attempts 
      SET 
        answers = COALESCE(answers, '{}'::jsonb) || (attempt_data->'answers'),
        updated_at = NOW()
      WHERE id = (attempt_data->>'attempt_id')::uuid
      RETURNING jsonb_build_object('saved', true, 'timestamp', updated_at) INTO result;
      
    WHEN 'submit_attempt' THEN
      UPDATE exam_attempts 
      SET 
        status = 'completed',
        completed_at = NOW(),
        final_answers = attempt_data->'answers',
        score = calculate_score(id, attempt_data->'answers')
      WHERE id = (attempt_data->>'attempt_id')::uuid
      RETURNING jsonb_build_object(
        'submitted', true, 
        'score', score, 
        'completed_at', completed_at
      ) INTO result;
      
    ELSE
      result = jsonb_build_object('error', 'Invalid operation type');
  END CASE;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Batch student operations RPC
CREATE OR REPLACE FUNCTION batch_student_operations(
  operation_type TEXT,
  student_data JSONB
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
  processed_count INTEGER := 0;
BEGIN
  CASE operation_type
    WHEN 'bulk_insert' THEN
      INSERT INTO students (name, code, email, exam_id)
      SELECT 
        (value->>'name')::TEXT,
        (value->>'code')::TEXT,
        (value->>'email')::TEXT,
        (student_data->>'exam_id')::uuid
      FROM jsonb_array_elements(student_data->'students') AS value;
      
      GET DIAGNOSTICS processed_count = ROW_COUNT;
      result = jsonb_build_object('inserted', processed_count);
      
    WHEN 'bulk_update' THEN
      UPDATE students 
      SET 
        name = COALESCE((updates.value->>'name')::TEXT, name),
        email = COALESCE((updates.value->>'email')::TEXT, email),
        updated_at = NOW()
      FROM jsonb_array_elements(student_data->'updates') AS updates
      WHERE students.id = (updates.value->>'id')::uuid;
      
      GET DIAGNOSTICS processed_count = ROW_COUNT;
      result = jsonb_build_object('updated', processed_count);
      
    ELSE
      result = jsonb_build_object('error', 'Invalid operation type');
  END CASE;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

#### 2. Performance Monitoring RPC

```sql
-- Performance monitoring and metrics collection
CREATE OR REPLACE FUNCTION get_performance_metrics(
  time_period INTERVAL DEFAULT '1 hour'::INTERVAL
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  WITH metrics AS (
    SELECT 
      COUNT(*) as total_requests,
      AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))) as p95_duration
    FROM request_logs 
    WHERE created_at > NOW() - time_period
  ),
  db_metrics AS (
    SELECT 
      numbackends as active_connections,
      xact_commit as transactions_committed,
      xact_rollback as transactions_rolled_back,
      blks_read as blocks_read,
      blks_hit as blocks_hit,
      ROUND((blks_hit::FLOAT / NULLIF(blks_hit + blks_read, 0)) * 100, 2) as cache_hit_ratio
    FROM pg_stat_database 
    WHERE datname = current_database()
  )
  SELECT jsonb_build_object(
    'requests', row_to_json(metrics),
    'database', row_to_json(db_metrics),
    'timestamp', NOW()
  ) INTO result
  FROM metrics, db_metrics;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

## Cache Optimization

### Multi-Tier Caching Strategy

#### 1. Cache Layer Architecture

```javascript
// Multi-tier cache implementation
class MultiTierCache {
  constructor() {
    this.memoryCache = new Map();
    this.redisCache = new Redis(process.env.REDIS_URL);
    this.edgeCache = new EdgeCache();
    
    // Cache configuration
    this.config = {
      memory: {
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 300 // 5 minutes
      },
      redis: {
        ttl: 3600 // 1 hour
      },
      edge: {
        ttl: 86400 // 24 hours
      }
    };
  }
  
  async get(key) {
    // Try memory cache first (fastest)
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult && !this.isExpired(memoryResult)) {
      return memoryResult.value;
    }
    
    // Try Redis cache (medium speed)
    const redisResult = await this.redisCache.get(key);
    if (redisResult) {
      const parsed = JSON.parse(redisResult);
      // Populate memory cache
      this.setMemory(key, parsed, this.config.memory.ttl);
      return parsed;
    }
    
    // Try edge cache (slowest but most persistent)
    const edgeResult = await this.edgeCache.get(key);
    if (edgeResult) {
      // Populate both memory and Redis caches
      this.setMemory(key, edgeResult, this.config.memory.ttl);
      await this.setRedis(key, edgeResult, this.config.redis.ttl);
      return edgeResult;
    }
    
    return null;
  }
  
  async set(key, value, ttl = null) {
    // Set in all cache tiers
    await Promise.all([
      this.setMemory(key, value, ttl || this.config.memory.ttl),
      this.setRedis(key, value, ttl || this.config.redis.ttl),
      this.setEdge(key, value, ttl || this.config.edge.ttl)
    ]);
  }
  
  setMemory(key, value, ttl) {
    // Implement LRU eviction if memory limit exceeded
    if (this.getMemoryUsage() > this.config.memory.maxSize) {
      this.evictLRU();
    }
    
    this.memoryCache.set(key, {
      value,
      expires: Date.now() + (ttl * 1000),
      accessed: Date.now()
    });
  }
  
  async setRedis(key, value, ttl) {
    await this.redisCache.setex(key, ttl, JSON.stringify(value));
  }
  
  async setEdge(key, value, ttl) {
    await this.edgeCache.set(key, value, ttl);
  }
  
  async invalidate(key) {
    // Invalidate from all tiers
    this.memoryCache.delete(key);
    await this.redisCache.del(key);
    await this.edgeCache.delete(key);
  }
  
  async invalidatePattern(pattern) {
    // Invalidate keys matching pattern
    const keys = await this.redisCache.keys(pattern);
    
    for (const key of keys) {
      await this.invalidate(key);
    }
  }
  
  isExpired(cacheEntry) {
    return Date.now() > cacheEntry.expires;
  }
  
  evictLRU() {
    // Find least recently used entries
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].accessed - b[1].accessed);
    
    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.memoryCache.delete(entries[i][0]);
    }
  }
  
  getMemoryUsage() {
    return JSON.stringify(Array.from(this.memoryCache.values())).length;
  }
}
```

#### 2. Intelligent Cache Warming

```javascript
// Cache warming strategies
class CacheWarmer {
  constructor(cache) {
    this.cache = cache;
    this.warmingQueue = [];
    this.isWarming = false;
  }
  
  async warmCriticalData() {
    const criticalQueries = [
      {
        key: 'active_exams',
        query: () => this.getActiveExams(),
        ttl: 3600
      },
      {
        key: 'system_settings',
        query: () => this.getSystemSettings(),
        ttl: 7200
      },
      {
        key: 'exam_templates',
        query: () => this.getExamTemplates(),
        ttl: 86400
      }
    ];
    
    for (const item of criticalQueries) {
      try {
        const data = await item.query();
        await this.cache.set(item.key, data, item.ttl);
        console.log(`Warmed cache for: ${item.key}`);
      } catch (error) {
        console.error(`Failed to warm cache for ${item.key}:`, error);
      }
    }
  }
  
  async warmExamData(examId) {
    const examQueries = [
      {
        key: `exam:${examId}:info`,
        query: () => this.getExamInfo(examId)
      },
      {
        key: `exam:${examId}:questions`,
        query: () => this.getExamQuestions(examId)
      },
      {
        key: `exam:${examId}:settings`,
        query: () => this.getExamSettings(examId)
      }
    ];
    
    await Promise.all(
      examQueries.map(async (item) => {
        const data = await item.query();
        await this.cache.set(item.key, data, 3600);
      })
    );
  }
  
  scheduleWarming() {
    // Warm cache during low-traffic periods
    const warmingSchedule = [
      { hour: 2, action: () => this.warmCriticalData() },
      { hour: 6, action: () => this.warmPopularExams() },
      { hour: 22, action: () => this.cleanupExpiredEntries() }
    ];
    
    warmingSchedule.forEach(schedule => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(schedule.hour, 0, 0, 0);
      
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      const delay = scheduledTime.getTime() - now.getTime();
      setTimeout(() => {
        schedule.action();
        // Repeat daily
        setInterval(schedule.action, 24 * 60 * 60 * 1000);
      }, delay);
    });
  }
  
  async warmPopularExams() {
    // Get most accessed exams from analytics
    const popularExams = await this.getPopularExams();
    
    for (const exam of popularExams) {
      await this.warmExamData(exam.id);
    }
  }
}
```

#### 3. Cache Analytics and Optimization

```javascript
// Cache performance analytics
class CacheAnalytics {
  constructor(cache) {
    this.cache = cache;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      errors: 0
    };
    this.keyMetrics = new Map();
  }
  
  recordHit(key) {
    this.metrics.hits++;
    this.updateKeyMetrics(key, 'hit');
  }
  
  recordMiss(key) {
    this.metrics.misses++;
    this.updateKeyMetrics(key, 'miss');
  }
  
  recordSet(key) {
    this.metrics.sets++;
    this.updateKeyMetrics(key, 'set');
  }
  
  recordInvalidation(key) {
    this.metrics.invalidations++;
    this.updateKeyMetrics(key, 'invalidation');
  }
  
  updateKeyMetrics(key, action) {
    if (!this.keyMetrics.has(key)) {
      this.keyMetrics.set(key, {
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        lastAccessed: Date.now()
      });
    }
    
    const keyMetric = this.keyMetrics.get(key);
    keyMetric[action === 'hit' ? 'hits' : action === 'miss' ? 'misses' : action]++;
    keyMetric.lastAccessed = Date.now();
  }
  
  getHitRate() {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }
  
  getTopKeys(limit = 10) {
    return Array.from(this.keyMetrics.entries())
      .map(([key, metrics]) => ({
        key,
        ...metrics,
        hitRate: metrics.hits / (metrics.hits + metrics.misses) || 0
      }))
      .sort((a, b) => (b.hits + b.misses) - (a.hits + a.misses))
      .slice(0, limit);
  }
  
  getUnderutilizedKeys() {
    const threshold = 0.3; // 30% hit rate threshold
    
    return Array.from(this.keyMetrics.entries())
      .filter(([key, metrics]) => {
        const hitRate = metrics.hits / (metrics.hits + metrics.misses) || 0;
        return hitRate < threshold && (metrics.hits + metrics.misses) > 10;
      })
      .map(([key, metrics]) => ({
        key,
        hitRate: metrics.hits / (metrics.hits + metrics.misses) || 0,
        totalAccess: metrics.hits + metrics.misses
      }));
  }
  
  generateReport() {
    return {
      summary: {
        hitRate: this.getHitRate(),
        totalRequests: this.metrics.hits + this.metrics.misses,
        ...this.metrics
      },
      topKeys: this.getTopKeys(),
      underutilizedKeys: this.getUnderutilizedKeys(),
      recommendations: this.generateRecommendations()
    };
  }
  
  generateRecommendations() {
    const recommendations = [];
    const hitRate = this.getHitRate();
    
    if (hitRate < 0.8) {
      recommendations.push({
        type: 'hit_rate',
        message: 'Cache hit rate is below 80%. Consider increasing TTL for frequently accessed data.',
        priority: 'high'
      });
    }
    
    const underutilized = this.getUnderutilizedKeys();
    if (underutilized.length > 0) {
      recommendations.push({
        type: 'underutilized',
        message: `${underutilized.length} cache keys have low hit rates. Consider removing or optimizing these keys.`,
        priority: 'medium',
        keys: underutilized.slice(0, 5).map(k => k.key)
      });
    }
    
    return recommendations;
  }
}
```

This performance tuning guide provides comprehensive optimization strategies for all aspects of the consolidated function architecture, ensuring optimal performance and resource utilization.