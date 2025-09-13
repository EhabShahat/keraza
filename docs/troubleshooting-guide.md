# Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting procedures for the consolidated function architecture, covering common issues, diagnostic steps, and resolution procedures.

## Quick Diagnostic Checklist

### System Health Check
1. **Function Status**: Check `/api/admin/monitoring/health`
2. **Database Connectivity**: Verify Supabase connection
3. **Cache Performance**: Review cache hit rates
4. **Error Rates**: Monitor function error rates
5. **Response Times**: Check API response performance

### Common Symptoms and Quick Fixes

| Symptom | Quick Check | Immediate Action |
|---------|-------------|------------------|
| Slow API responses | Cache hit rate < 70% | Warm cache, check TTL settings |
| 500 errors | Database connections | Restart functions, check DB pool |
| Authentication failures | JWT validation | Clear auth cache, check token expiry |
| Cache inconsistency | Invalidation logs | Manual cache clear, check triggers |
| High memory usage | Function metrics | Restart functions, check for leaks |

## Detailed Troubleshooting Procedures

### 1. Performance Issues

#### Slow API Response Times

**Symptoms:**
- API responses taking > 2 seconds
- Timeout errors in client applications
- High function execution times

**Diagnostic Steps:**

1. **Check Function Metrics**
```bash
# Monitor function performance
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/monitoring/analytics?period=1h&metrics=response_time"
```

2. **Analyze Database Performance**
```bash
# Check database query performance
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/database/performance"
```

3. **Review Cache Performance**
```bash
# Check cache hit rates
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/analytics?period=1h"
```

**Resolution Steps:**

1. **Optimize Caching**
```javascript
// Warm critical caches
const warmCache = async () => {
  const criticalEndpoints = [
    '/api/public/exam-info?exam_id=active_exam',
    '/api/public/system-status',
    '/api/admin/exams/list'
  ];
  
  for (const endpoint of criticalEndpoints) {
    await fetch(endpoint);
  }
};
```

2. **Database Query Optimization**
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC;
```

3. **Function Memory Optimization**
```javascript
// Monitor memory usage
const checkMemoryUsage = () => {
  const usage = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
  });
};
```

#### High Memory Usage

**Symptoms:**
- Function memory usage > 80%
- Out of memory errors
- Function restarts

**Diagnostic Steps:**

1. **Memory Profiling**
```javascript
// Add to function handler
const v8 = require('v8');
const heapSnapshot = v8.writeHeapSnapshot();
console.log('Heap snapshot written to:', heapSnapshot);
```

2. **Check for Memory Leaks**
```javascript
// Monitor heap growth
setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 100 * 1024 * 1024) { // 100MB threshold
    console.warn('High memory usage detected:', usage);
  }
}, 30000);
```

**Resolution Steps:**

1. **Implement Proper Cleanup**
```javascript
// Ensure proper resource cleanup
const handleRequest = async (req, res) => {
  let dbConnection;
  try {
    dbConnection = await getDbConnection();
    // Handle request
  } finally {
    if (dbConnection) {
      await dbConnection.release();
    }
  }
};
```

2. **Optimize Data Structures**
```javascript
// Use efficient data structures
const cache = new Map(); // Instead of plain objects
const weakCache = new WeakMap(); // For object references
```

### 2. Authentication and Authorization Issues

#### JWT Token Validation Failures

**Symptoms:**
- 401 Unauthorized errors
- Token validation timeouts
- Inconsistent authentication behavior

**Diagnostic Steps:**

1. **Verify Token Structure**
```javascript
// Decode JWT without verification
const jwt = require('jsonwebtoken');
const decoded = jwt.decode(token, { complete: true });
console.log('Token header:', decoded.header);
console.log('Token payload:', decoded.payload);
```

2. **Check Token Expiry**
```javascript
// Validate token expiration
const isTokenExpired = (token) => {
  const decoded = jwt.decode(token);
  return decoded.exp < Date.now() / 1000;
};
```

3. **Test Token Validation**
```bash
# Test token validation endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.netlify.app/api/admin/health"
```

**Resolution Steps:**

1. **Clear Authentication Cache**
```javascript
// Clear cached authentication data
const clearAuthCache = async (userId) => {
  const cacheKeys = [
    `auth:user:${userId}`,
    `auth:permissions:${userId}`,
    `auth:session:${userId}`
  ];
  
  for (const key of cacheKeys) {
    await cache.delete(key);
  }
};
```

2. **Refresh JWT Tokens**
```javascript
// Implement token refresh logic
const refreshToken = async (refreshToken) => {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  
  return response.json();
};
```

#### Permission Denied Errors

**Symptoms:**
- 403 Forbidden errors
- Access denied for valid users
- Inconsistent permission checks

**Diagnostic Steps:**

1. **Check User Permissions**
```sql
-- Verify user roles and permissions
SELECT u.id, u.email, u.role, u.permissions 
FROM admin_users u 
WHERE u.id = $1;
```

2. **Review Permission Cache**
```javascript
// Check cached permissions
const getUserPermissions = async (userId) => {
  const cached = await cache.get(`permissions:${userId}`);
  console.log('Cached permissions:', cached);
  
  // Compare with database
  const dbPermissions = await db.query(
    'SELECT permissions FROM admin_users WHERE id = $1',
    [userId]
  );
  console.log('Database permissions:', dbPermissions.rows[0]);
};
```

**Resolution Steps:**

1. **Update User Permissions**
```sql
-- Update user permissions
UPDATE admin_users 
SET permissions = $2, updated_at = NOW() 
WHERE id = $1;
```

2. **Clear Permission Cache**
```javascript
// Force permission cache refresh
const refreshUserPermissions = async (userId) => {
  await cache.delete(`permissions:${userId}`);
  // Next request will fetch fresh permissions
};
```

### 3. Database Connection Issues

#### Connection Pool Exhaustion

**Symptoms:**
- "Connection pool exhausted" errors
- Database timeout errors
- Slow database operations

**Diagnostic Steps:**

1. **Monitor Connection Pool**
```javascript
// Check pool status
const pool = require('./db-pool');
console.log('Pool status:', {
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount
});
```

2. **Check Long-Running Queries**
```sql
-- Find long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

**Resolution Steps:**

1. **Increase Pool Size**
```javascript
// Adjust connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Increase from default
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

2. **Implement Connection Retry**
```javascript
// Add connection retry logic
const connectWithRetry = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.connect();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

#### Query Performance Issues

**Symptoms:**
- Slow database queries
- Query timeouts
- High CPU usage on database

**Diagnostic Steps:**

1. **Analyze Query Performance**
```sql
-- Check query statistics
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

2. **Check Index Usage**
```sql
-- Verify index effectiveness
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename IN ('exams', 'students', 'exam_attempts');
```

**Resolution Steps:**

1. **Add Missing Indexes**
```sql
-- Create performance indexes
CREATE INDEX CONCURRENTLY idx_exam_attempts_student_exam 
ON exam_attempts(student_id, exam_id);

CREATE INDEX CONCURRENTLY idx_exam_attempts_status_created 
ON exam_attempts(status, created_at);
```

2. **Optimize Queries**
```javascript
// Use prepared statements
const getExamResults = async (examId) => {
  const query = `
    SELECT s.name, s.code, ea.score, ea.completed_at
    FROM exam_attempts ea
    JOIN students s ON s.id = ea.student_id
    WHERE ea.exam_id = $1 AND ea.status = 'completed'
    ORDER BY ea.score DESC
  `;
  
  return db.query(query, [examId]);
};
```

### 4. Cache-Related Issues

#### Cache Inconsistency

**Symptoms:**
- Stale data returned from API
- Inconsistent responses
- Data not updating after changes

**Diagnostic Steps:**

1. **Check Cache Invalidation**
```javascript
// Verify cache invalidation logs
const checkInvalidationLogs = async () => {
  const logs = await db.query(`
    SELECT * FROM cache_invalidation_log 
    WHERE created_at > NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
  `);
  console.log('Recent invalidations:', logs.rows);
};
```

2. **Compare Cache vs Database**
```javascript
// Verify data consistency
const verifyDataConsistency = async (examId) => {
  const cached = await cache.get(`exam:${examId}:info`);
  const fresh = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
  
  console.log('Cached data:', cached);
  console.log('Database data:', fresh.rows[0]);
};
```

**Resolution Steps:**

1. **Manual Cache Invalidation**
```bash
# Clear specific cache entries
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["exam_123"], "keys": ["exam:123:info"]}' \
  "https://your-domain.netlify.app/api/cache/invalidate"
```

2. **Fix Invalidation Triggers**
```javascript
// Ensure proper cache invalidation
const updateExam = async (examId, updates) => {
  // Update database
  await db.query('UPDATE exams SET ... WHERE id = $1', [examId]);
  
  // Invalidate related cache entries
  await cache.invalidateTags([`exam_${examId}`, 'exam_list']);
};
```

#### Low Cache Hit Rate

**Symptoms:**
- Cache hit rate < 70%
- High database load
- Slow response times

**Diagnostic Steps:**

1. **Analyze Cache Patterns**
```bash
# Check cache analytics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/analytics?period=24h"
```

2. **Review Cache Configuration**
```javascript
// Check TTL settings
const cacheConfig = {
  'exam:info': { ttl: 3600 }, // 1 hour
  'student:profile': { ttl: 1800 }, // 30 minutes
  'system:settings': { ttl: 7200 } // 2 hours
};
```

**Resolution Steps:**

1. **Optimize Cache Strategy**
```javascript
// Implement cache warming
const warmCriticalCaches = async () => {
  const activeExams = await db.query('SELECT id FROM exams WHERE status = $1', ['active']);
  
  for (const exam of activeExams.rows) {
    await cache.set(`exam:${exam.id}:info`, await getExamInfo(exam.id), 3600);
  }
};
```

2. **Adjust TTL Settings**
```javascript
// Optimize cache TTL based on data volatility
const getCacheTTL = (dataType) => {
  const ttlMap = {
    'static': 86400,    // 24 hours
    'semi-static': 3600, // 1 hour
    'dynamic': 300,      // 5 minutes
    'real-time': 60      // 1 minute
  };
  
  return ttlMap[dataType] || 300;
};
```

### 5. Function Deployment Issues

#### Deployment Failures

**Symptoms:**
- Build failures during deployment
- Function not updating after deployment
- Rollback not working

**Diagnostic Steps:**

1. **Check Build Logs**
```bash
# Review Netlify build logs
netlify logs:functions --name=admin-handler
```

2. **Verify Function Configuration**
```javascript
// Check netlify.toml configuration
[build]
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[functions]]
  path = "/api/admin/*"
  function = "admin-handler"
```

**Resolution Steps:**

1. **Fix Build Issues**
```bash
# Clear build cache and redeploy
netlify build --clear-cache
netlify deploy --prod
```

2. **Manual Rollback**
```bash
# Rollback to previous deployment
netlify rollback --site-id=your-site-id
```

#### Function Cold Starts

**Symptoms:**
- First request after idle period is slow
- Intermittent timeout errors
- Variable response times

**Diagnostic Steps:**

1. **Monitor Cold Start Frequency**
```javascript
// Track cold starts
let isWarm = false;

export const handler = async (event, context) => {
  const startTime = Date.now();
  
  if (!isWarm) {
    console.log('Cold start detected');
    isWarm = true;
  }
  
  // Handle request
  const duration = Date.now() - startTime;
  console.log('Request duration:', duration);
};
```

**Resolution Steps:**

1. **Implement Keep-Warm Strategy**
```javascript
// Periodic function warming
const keepWarm = async () => {
  const endpoints = [
    '/api/admin/health',
    '/api/public/system-status',
    '/api/attempts/health'
  ];
  
  for (const endpoint of endpoints) {
    try {
      await fetch(`https://your-domain.netlify.app${endpoint}`);
    } catch (error) {
      console.warn('Keep-warm failed for:', endpoint);
    }
  }
};

// Run every 5 minutes
setInterval(keepWarm, 5 * 60 * 1000);
```

2. **Optimize Bundle Size**
```javascript
// Use dynamic imports for large dependencies
const handleLargeOperation = async () => {
  const { heavyLibrary } = await import('./heavy-library');
  return heavyLibrary.process();
};
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Function Performance**
   - Response time (target: < 500ms)
   - Error rate (target: < 1%)
   - Memory usage (target: < 80%)
   - Cold start frequency

2. **Database Performance**
   - Query execution time (target: < 100ms)
   - Connection pool usage (target: < 80%)
   - Active connections
   - Slow query count

3. **Cache Performance**
   - Hit rate (target: > 80%)
   - Miss rate
   - Invalidation frequency
   - Memory usage

### Alert Thresholds

```javascript
const alertThresholds = {
  response_time: 1000,      // 1 second
  error_rate: 0.05,         // 5%
  memory_usage: 0.8,        // 80%
  cache_hit_rate: 0.7,      // 70%
  db_connection_usage: 0.8,  // 80%
  db_query_time: 500        // 500ms
};
```

### Health Check Endpoints

1. **Function Health**: `/api/admin/health`
2. **Database Health**: `/api/admin/database/health`
3. **Cache Health**: `/api/cache/health`
4. **Overall System**: `/api/health`

## Emergency Procedures

### Complete System Failure

1. **Immediate Actions**
   - Check Netlify status page
   - Verify DNS resolution
   - Check Supabase status
   - Review recent deployments

2. **Rollback Procedure**
   ```bash
   # Emergency rollback
   netlify rollback --site-id=your-site-id --alias=previous
   ```

3. **Communication**
   - Update status page
   - Notify stakeholders
   - Document incident

### Database Emergency

1. **Connection Issues**
   - Restart connection pools
   - Check Supabase dashboard
   - Verify network connectivity

2. **Performance Issues**
   - Kill long-running queries
   - Restart read replicas
   - Enable maintenance mode

### Cache Emergency

1. **Complete Cache Clear**
   ```bash
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://your-domain.netlify.app/api/cache/clear-all"
   ```

2. **Disable Caching**
   ```javascript
   // Temporary cache bypass
   process.env.CACHE_DISABLED = 'true';
   ```

## Recovery Procedures

### Post-Incident Recovery

1. **Verify System Health**
   - Run comprehensive health checks
   - Validate all critical functions
   - Check data consistency

2. **Performance Validation**
   - Run load tests
   - Verify response times
   - Check error rates

3. **Documentation**
   - Document incident timeline
   - Update runbooks
   - Implement preventive measures

This troubleshooting guide provides comprehensive procedures for diagnosing and resolving issues in the consolidated function architecture. Regular monitoring and proactive maintenance help prevent most issues before they impact users.