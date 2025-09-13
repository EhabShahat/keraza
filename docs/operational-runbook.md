# Operational Runbook

## Overview

This runbook provides step-by-step procedures for operating and maintaining the consolidated function architecture. It covers daily operations, monitoring procedures, maintenance tasks, and emergency response protocols.

## Daily Operations

### Morning Health Check (5 minutes)

**Frequency**: Every weekday at 8:00 AM
**Responsibility**: DevOps/Operations team

#### Checklist

1. **System Health Verification**
```bash
# Check overall system health
curl -s "https://your-domain.netlify.app/api/admin/health" | jq '.data.status'
# Expected: "healthy"
```

2. **Function Performance Check**
```bash
# Get 24-hour performance summary
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/monitoring/analytics?period=24h" | \
  jq '.data | {avg_response_time, error_rate, cache_hit_rate}'
```

3. **Database Health Verification**
```bash
# Check database performance
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/database/performance" | \
  jq '.data | {connection_count, avg_query_time, slow_queries}'
```

4. **Cache Performance Review**
```bash
# Verify cache performance
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/analytics?period=24h" | \
  jq '.data | {hit_rate, total_requests, invalidation_events}'
```

#### Success Criteria
- System status: "healthy"
- Average response time: < 500ms
- Error rate: < 1%
- Cache hit rate: > 80%
- Database connections: < 80% of pool

#### Escalation
If any metric fails criteria:
1. Check detailed logs in monitoring dashboard
2. Review recent deployments
3. Escalate to on-call engineer if issues persist > 15 minutes

### Weekly Performance Review (30 minutes)

**Frequency**: Every Monday at 9:00 AM
**Responsibility**: Technical lead

#### Performance Analysis

1. **Function Optimization Review**
```bash
# Get weekly performance trends
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/monitoring/analytics?period=7d&metrics=response_time,error_rate,memory_usage" \
  > weekly_performance.json
```

2. **Cost Analysis**
```bash
# Review function costs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/monitoring/cost-analysis?period=7d" \
  > weekly_costs.json
```

3. **Database Performance Trends**
```bash
# Analyze database performance
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/database/performance?period=7d" \
  > weekly_db_performance.json
```

#### Action Items
- Identify performance degradation trends
- Plan optimization tasks for upcoming sprint
- Update capacity planning projections
- Review and adjust alert thresholds

### Monthly Maintenance (2 hours)

**Frequency**: First Saturday of each month
**Responsibility**: DevOps team

#### Maintenance Tasks

1. **Cache Cleanup and Optimization**
```bash
# Clear stale cache entries
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/cleanup"

# Warm critical caches
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/warm"
```

2. **Database Maintenance**
```sql
-- Run database maintenance queries
VACUUM ANALYZE;
REINDEX DATABASE your_database;

-- Update table statistics
ANALYZE exam_attempts;
ANALYZE students;
ANALYZE exams;
```

3. **Log Rotation and Cleanup**
```bash
# Archive old logs (keep 90 days)
find /var/log/netlify-functions -name "*.log" -mtime +90 -delete

# Compress recent logs
find /var/log/netlify-functions -name "*.log" -mtime +7 -exec gzip {} \;
```

4. **Security Updates**
```bash
# Check for dependency updates
npm audit
npm update

# Review security advisories
npm audit --audit-level moderate
```

## Monitoring Procedures

### Real-time Monitoring Dashboard

**Access**: https://your-domain.netlify.app/admin/monitoring
**Authentication**: Admin credentials required

#### Key Metrics to Monitor

1. **Function Health Indicators**
   - Response time trends
   - Error rate patterns
   - Memory usage graphs
   - Cold start frequency

2. **Database Performance**
   - Active connections
   - Query execution times
   - Slow query alerts
   - Connection pool usage

3. **Cache Performance**
   - Hit/miss ratios
   - Invalidation patterns
   - Memory usage
   - Response time impact

4. **User Experience Metrics**
   - Page load times
   - API response times
   - Error rates by endpoint
   - Geographic performance

### Alert Configuration

#### Critical Alerts (Immediate Response Required)

```javascript
const criticalAlerts = {
  system_down: {
    condition: 'health_status != "healthy"',
    threshold: '1 occurrence',
    notification: ['sms', 'email', 'slack'],
    escalation: '5 minutes'
  },
  high_error_rate: {
    condition: 'error_rate > 5%',
    threshold: '2 minutes sustained',
    notification: ['email', 'slack'],
    escalation: '10 minutes'
  },
  database_connection_failure: {
    condition: 'db_connections = 0',
    threshold: '1 occurrence',
    notification: ['sms', 'email', 'slack'],
    escalation: '2 minutes'
  }
};
```

#### Warning Alerts (Response Within 1 Hour)

```javascript
const warningAlerts = {
  performance_degradation: {
    condition: 'avg_response_time > 1000ms',
    threshold: '5 minutes sustained',
    notification: ['email', 'slack']
  },
  low_cache_hit_rate: {
    condition: 'cache_hit_rate < 70%',
    threshold: '10 minutes sustained',
    notification: ['email']
  },
  high_memory_usage: {
    condition: 'memory_usage > 80%',
    threshold: '5 minutes sustained',
    notification: ['email', 'slack']
  }
};
```

### Log Analysis Procedures

#### Daily Log Review

1. **Error Pattern Analysis**
```bash
# Search for error patterns in last 24 hours
grep -E "(ERROR|FATAL)" /var/log/netlify-functions/*.log | \
  awk '{print $1, $2, $3}' | sort | uniq -c | sort -nr
```

2. **Performance Anomaly Detection**
```bash
# Find slow requests (>2 seconds)
grep "duration.*[2-9][0-9][0-9][0-9]ms" /var/log/netlify-functions/*.log | \
  head -20
```

3. **Authentication Issues**
```bash
# Check authentication failures
grep -i "unauthorized\|forbidden\|auth.*fail" /var/log/netlify-functions/*.log | \
  tail -50
```

#### Weekly Log Analysis

1. **Trend Analysis**
```bash
# Generate weekly error summary
for day in {1..7}; do
  date=$(date -d "$day days ago" +%Y-%m-%d)
  echo "=== $date ==="
  grep "$date" /var/log/netlify-functions/*.log | \
    grep -c "ERROR"
done
```

2. **Performance Trends**
```bash
# Analyze response time trends
grep "duration" /var/log/netlify-functions/*.log | \
  awk '{print $1, $NF}' | \
  sed 's/ms//' | \
  awk '{sum+=$2; count++} END {print "Average:", sum/count "ms"}'
```

## Maintenance Procedures

### Routine Maintenance Tasks

#### Database Optimization (Weekly)

1. **Index Maintenance**
```sql
-- Check index usage statistics
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_tup_read = 0
ORDER BY schemaname, tablename;

-- Rebuild unused indexes
REINDEX INDEX CONCURRENTLY idx_name;
```

2. **Query Performance Analysis**
```sql
-- Find slow queries
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

3. **Connection Pool Optimization**
```javascript
// Monitor and adjust pool settings
const poolConfig = {
  max: process.env.DB_POOL_MAX || 20,
  min: process.env.DB_POOL_MIN || 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};

// Log pool statistics
setInterval(() => {
  console.log('Pool stats:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 60000);
```

#### Cache Maintenance (Daily)

1. **Cache Health Check**
```bash
# Verify cache connectivity
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/health"
```

2. **Cache Warming**
```bash
# Warm critical caches during low traffic
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/warm" \
  -d '{"endpoints": ["exam-info", "system-settings", "active-exams"]}'
```

3. **Cache Cleanup**
```bash
# Remove expired entries
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/cleanup"
```

#### Function Optimization (Monthly)

1. **Bundle Size Analysis**
```bash
# Analyze function bundle sizes
netlify functions:list --json | jq '.[] | {name, size}'
```

2. **Memory Usage Optimization**
```javascript
// Monitor memory usage patterns
const analyzeMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024)
  };
};
```

3. **Cold Start Optimization**
```javascript
// Implement connection warming
const warmConnections = async () => {
  // Pre-establish database connections
  await db.query('SELECT 1');
  
  // Warm cache connections
  await cache.get('health-check');
  
  // Initialize shared resources
  await initializeSharedResources();
};
```

### Security Maintenance

#### Weekly Security Review

1. **Dependency Audit**
```bash
# Check for security vulnerabilities
npm audit --audit-level moderate

# Update dependencies
npm update
npm audit fix
```

2. **Access Log Analysis**
```bash
# Check for suspicious access patterns
grep -E "(401|403|429)" /var/log/netlify-functions/access.log | \
  awk '{print $1}' | sort | uniq -c | sort -nr | head -20
```

3. **Authentication Token Review**
```sql
-- Check for expired or suspicious tokens
SELECT user_id, created_at, expires_at, last_used
FROM auth_tokens
WHERE expires_at < NOW() OR last_used < NOW() - INTERVAL '30 days';
```

#### Monthly Security Tasks

1. **Certificate Management**
```bash
# Check SSL certificate expiration
openssl s_client -connect your-domain.netlify.app:443 -servername your-domain.netlify.app 2>/dev/null | \
  openssl x509 -noout -dates
```

2. **Access Control Review**
```sql
-- Review admin user permissions
SELECT id, email, role, permissions, last_login
FROM admin_users
WHERE last_login < NOW() - INTERVAL '90 days';
```

3. **Audit Log Analysis**
```sql
-- Review security-related events
SELECT action, user_id, ip_address, created_at
FROM audit_logs
WHERE action IN ('login_failed', 'permission_denied', 'suspicious_activity')
AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

## Performance Tuning Procedures

### Response Time Optimization

#### Identify Bottlenecks

1. **Function Performance Analysis**
```bash
# Get detailed performance metrics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/monitoring/analytics?period=24h&breakdown=endpoint" | \
  jq '.data.endpoints | sort_by(.avg_response_time) | reverse | .[0:10]'
```

2. **Database Query Optimization**
```sql
-- Identify slow queries
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY total_exec_time DESC
LIMIT 10;
```

3. **Cache Performance Analysis**
```bash
# Analyze cache miss patterns
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/analytics?period=24h&breakdown=endpoint" | \
  jq '.data.endpoints | map(select(.hit_rate < 0.8)) | sort_by(.hit_rate)'
```

#### Optimization Strategies

1. **Database Query Optimization**
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_exam_attempts_performance 
ON exam_attempts(exam_id, status, created_at) 
WHERE status IN ('in_progress', 'completed');

-- Optimize frequently used queries
EXPLAIN ANALYZE SELECT * FROM exam_attempts 
WHERE exam_id = $1 AND status = 'completed'
ORDER BY score DESC;
```

2. **Cache Strategy Optimization**
```javascript
// Implement intelligent cache warming
const optimizeCacheStrategy = async () => {
  // Identify frequently accessed data
  const hotData = await getFrequentlyAccessedData();
  
  // Warm caches proactively
  for (const item of hotData) {
    await cache.set(item.key, item.data, item.ttl);
  }
};
```

3. **Function Bundle Optimization**
```javascript
// Use dynamic imports for large dependencies
const optimizeBundle = async () => {
  // Load heavy libraries only when needed
  const { heavyLibrary } = await import('./heavy-library');
  return heavyLibrary;
};
```

### Memory Usage Optimization

#### Memory Leak Detection

1. **Heap Analysis**
```javascript
// Monitor heap growth
const monitorHeap = () => {
  const baseline = process.memoryUsage().heapUsed;
  
  setInterval(() => {
    const current = process.memoryUsage().heapUsed;
    const growth = current - baseline;
    
    if (growth > 50 * 1024 * 1024) { // 50MB growth
      console.warn('Potential memory leak detected:', {
        baseline: Math.round(baseline / 1024 / 1024) + 'MB',
        current: Math.round(current / 1024 / 1024) + 'MB',
        growth: Math.round(growth / 1024 / 1024) + 'MB'
      });
    }
  }, 60000);
};
```

2. **Resource Cleanup**
```javascript
// Implement proper cleanup
const handleRequest = async (req, res) => {
  const resources = [];
  
  try {
    const dbConnection = await getDbConnection();
    resources.push(() => dbConnection.release());
    
    const cacheConnection = await getCacheConnection();
    resources.push(() => cacheConnection.disconnect());
    
    // Handle request
    return await processRequest(req, res);
  } finally {
    // Clean up all resources
    for (const cleanup of resources) {
      try {
        await cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  }
};
```

## Emergency Response Procedures

### Incident Response Workflow

#### Severity Levels

**P0 - Critical (Response: Immediate)**
- Complete system outage
- Data corruption or loss
- Security breach

**P1 - High (Response: 15 minutes)**
- Significant performance degradation
- Partial system outage
- Authentication failures

**P2 - Medium (Response: 1 hour)**
- Minor performance issues
- Non-critical feature failures
- Cache inconsistencies

**P3 - Low (Response: Next business day)**
- Cosmetic issues
- Documentation updates
- Enhancement requests

#### Response Procedures

1. **Initial Assessment (2 minutes)**
```bash
# Quick system health check
curl -s "https://your-domain.netlify.app/api/admin/health" | jq '.'

# Check recent deployments
netlify api listSiteDeploys --site-id=your-site-id | head -5

# Review error rates
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/monitoring/analytics?period=1h"
```

2. **Immediate Mitigation (5 minutes)**
```bash
# If deployment-related, rollback immediately
netlify rollback --site-id=your-site-id

# If cache-related, clear cache
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/clear-all"

# If database-related, check connection pool
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/admin/database/health"
```

3. **Communication (Ongoing)**
- Update status page
- Notify stakeholders via Slack/email
- Document timeline and actions taken

### Disaster Recovery

#### Backup Procedures

1. **Database Backup Verification**
```bash
# Verify daily backups exist
pg_dump -h your-db-host -U username -d database_name > backup_$(date +%Y%m%d).sql

# Test backup restoration (staging environment)
psql -h staging-db-host -U username -d staging_database < backup_$(date +%Y%m%d).sql
```

2. **Configuration Backup**
```bash
# Backup environment variables
netlify env:list --site-id=your-site-id > env_backup_$(date +%Y%m%d).txt

# Backup function configurations
cp netlify.toml netlify_backup_$(date +%Y%m%d).toml
```

#### Recovery Procedures

1. **Complete System Recovery**
```bash
# Deploy from known good state
git checkout last-known-good-commit
netlify deploy --prod --dir=dist

# Restore database if needed
psql -h your-db-host -U username -d database_name < latest_backup.sql

# Verify system health
curl "https://your-domain.netlify.app/api/admin/health"
```

2. **Partial Recovery**
```bash
# Restore specific functions
netlify functions:deploy admin-handler --prod

# Clear and rebuild caches
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.netlify.app/api/cache/rebuild"
```

This operational runbook provides comprehensive procedures for maintaining the consolidated function architecture, ensuring reliable operations and quick incident response.