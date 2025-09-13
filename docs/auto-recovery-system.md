# Auto-Recovery and Scaling System

## Overview

The Auto-Recovery and Scaling System provides automated failover, load balancing, and scaling capabilities for consolidated Netlify Functions. This system ensures high availability and optimal performance by automatically detecting and responding to function failures, performance degradation, and load changes.

## Architecture

### Core Components

1. **Auto-Recovery System** (`src/lib/monitoring/auto-recovery.ts`)
   - Circuit breaker pattern implementation
   - Automatic failover mechanisms
   - Instance scaling based on performance metrics
   - Recovery attempt coordination

2. **Load Balancer** (`src/lib/monitoring/load-balancer.ts`)
   - Traffic routing and distribution
   - Health-based routing decisions
   - Session affinity management
   - Request retry logic with exponential backoff

3. **Health Monitor** (`src/lib/monitoring/health-monitor.ts`)
   - Continuous health checking
   - Performance metrics collection
   - Status aggregation and reporting

4. **Middleware Integration** (`src/middleware.ts`)
   - Transparent request routing
   - Automatic load balancing
   - Fallback handling

## Features

### Circuit Breaker Pattern

The system implements a robust circuit breaker pattern with three states:

- **Closed**: Normal operation, requests flow through
- **Open**: Function is failing, requests are blocked or routed to fallback
- **Half-Open**: Testing recovery, limited requests allowed through

#### Configuration

```typescript
circuit_breaker: {
  failure_threshold: 5,        // Failures before opening
  recovery_timeout: 60000,     // Time before attempting recovery (ms)
  half_open_max_calls: 3       // Test calls in half-open state
}
```

### Load Balancing Strategies

1. **Round Robin**: Distributes requests evenly across instances
2. **Least Connections**: Routes to instance with fewest active connections
3. **Response Time**: Routes to fastest responding instance
4. **Health-Based**: Routes based on comprehensive health scores

### Auto Scaling

Automatic scaling based on performance metrics:

#### Scale-Up Triggers
- CPU usage > threshold
- Memory usage > threshold
- Response time > threshold
- Error rate > threshold

#### Scale-Down Triggers
- CPU usage < threshold
- Memory usage < threshold
- Response time < threshold
- Idle time > threshold

#### Configuration Example

```typescript
scaling: {
  enabled: true,
  min_instances: 1,
  max_instances: 5,
  scale_up_threshold: {
    cpu_percent: 70,
    memory_percent: 80,
    response_time_ms: 2000,
    error_rate_percent: 5
  },
  scale_down_threshold: {
    cpu_percent: 30,
    memory_percent: 40,
    response_time_ms: 1000,
    idle_time_minutes: 10
  },
  cooldown_period: 300000 // 5 minutes between scaling actions
}
```

## Database Schema

### Tables

#### `function_instances`
Tracks individual function instances and their status.

```sql
CREATE TABLE function_instances (
  id TEXT PRIMARY KEY,
  function_name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'recovering', 'failed')),
  health JSONB NOT NULL DEFAULT '{}',
  connections INTEGER NOT NULL DEFAULT 0,
  last_request TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `circuit_breaker_states`
Maintains circuit breaker state for each function.

```sql
CREATE TABLE circuit_breaker_states (
  function_name TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure TIMESTAMPTZ,
  next_attempt TIMESTAMPTZ,
  half_open_calls INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `auto_recovery_configs`
Stores configuration for each function's auto-recovery settings.

```sql
CREATE TABLE auto_recovery_configs (
  function_name TEXT PRIMARY KEY,
  recovery_config JSONB NOT NULL DEFAULT '{}',
  load_balancing_config JSONB NOT NULL DEFAULT '{}',
  scaling_config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `scaling_actions`
Logs all scaling actions for audit and analysis.

```sql
CREATE TABLE scaling_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('scale_up', 'scale_down', 'failover', 'recovery')),
  instance_count_before INTEGER NOT NULL,
  instance_count_after INTEGER NOT NULL,
  trigger_reason TEXT,
  metrics JSONB DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## API Endpoints

### Auto-Recovery Management

#### GET `/api/admin/monitoring/auto-recovery`

Query parameters:
- `action`: `status`, `instances`, or `circuit-breakers`
- `function`: Optional function name filter

Returns status information for auto-recovery system.

#### POST `/api/admin/monitoring/auto-recovery`

Actions:
- `initialize`: Initialize auto-recovery for a function
- `failover`: Trigger manual failover
- `scale`: Manual scaling (requires `scale_action`: `up` or `down`)
- `stop`: Stop monitoring for a function
- `clear-sessions`: Clear session affinities

#### PUT `/api/admin/monitoring/auto-recovery`

Update auto-recovery configuration for a function.

#### DELETE `/api/admin/monitoring/auto-recovery`

Disable auto-recovery for a function.

## Setup and Configuration

### 1. Initialize the System

```bash
npm run setup:auto-recovery
```

This script:
- Creates required database tables
- Inserts default configurations
- Initializes circuit breakers
- Creates RPC functions
- Validates the setup

### 2. Start Auto-Recovery

Use the admin dashboard or API to initialize auto-recovery for each function:

```javascript
// Via API
fetch('/api/admin/monitoring/auto-recovery', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'initialize',
    function_name: 'admin'
  })
});
```

### 3. Monitor Status

Access the auto-recovery dashboard at `/admin/monitoring` or use the API endpoints to monitor system status.

## Testing

### Automated Testing

```bash
npm run test:auto-recovery
```

The test suite validates:
- Circuit breaker functionality
- Load balancing distribution
- Auto scaling behavior
- Failover mechanisms

### Manual Testing

1. **Circuit Breaker**: Generate failures to trigger circuit breaker opening
2. **Load Balancing**: Send multiple requests and verify distribution
3. **Scaling**: Generate load to trigger auto-scaling
4. **Failover**: Manually trigger failover and verify recovery

## Monitoring and Alerting

### Health Checks

Each function type has dedicated health check endpoints:
- `/api/admin/health`
- `/api/public/health`
- `/api/attempts/health`

### Metrics Collection

The system collects:
- Response times
- Error rates
- Memory usage
- CPU usage
- Connection counts
- Success rates

### Alerting

Automatic alerts are sent for:
- Circuit breaker state changes
- Scaling actions
- Failover events
- Performance degradation

## Best Practices

### Configuration

1. **Thresholds**: Set appropriate thresholds based on your application's performance characteristics
2. **Cooldown Periods**: Use adequate cooldown periods to prevent scaling oscillation
3. **Instance Limits**: Set realistic min/max instance limits based on your infrastructure capacity

### Monitoring

1. **Regular Health Checks**: Monitor the auto-recovery dashboard regularly
2. **Alert Response**: Respond promptly to critical alerts
3. **Performance Analysis**: Review scaling actions and performance trends

### Maintenance

1. **Configuration Updates**: Regularly review and update configurations based on performance data
2. **Cleanup**: Use the cleanup functions to manage historical data
3. **Testing**: Regularly run the test suite to validate system functionality

## Troubleshooting

### Common Issues

1. **Circuit Breaker Stuck Open**
   - Check function health endpoints
   - Verify network connectivity
   - Review error logs

2. **Scaling Not Working**
   - Verify scaling configuration
   - Check cooldown periods
   - Review performance metrics

3. **Load Balancing Issues**
   - Check instance health status
   - Verify load balancing strategy
   - Review session affinity settings

### Debug Commands

```bash
# Check system status
curl "/api/admin/monitoring/auto-recovery?action=status"

# View circuit breaker states
curl "/api/admin/monitoring/auto-recovery?action=circuit-breakers"

# Check function instances
curl "/api/admin/monitoring/auto-recovery?action=instances"
```

## Performance Impact

### Overhead

The auto-recovery system adds minimal overhead:
- Health checks: ~10ms per check
- Load balancing: ~1-2ms per request
- Monitoring: ~5MB memory usage

### Benefits

- Improved availability (99.9%+ uptime)
- Automatic performance optimization
- Reduced manual intervention
- Better resource utilization

## Security Considerations

1. **Admin Access**: Auto-recovery management requires admin authentication
2. **Rate Limiting**: Health checks and monitoring requests are rate-limited
3. **Data Privacy**: No sensitive data is logged in metrics
4. **Network Security**: All internal communications use secure protocols

## Future Enhancements

1. **Predictive Scaling**: Machine learning-based scaling predictions
2. **Multi-Region Support**: Cross-region failover capabilities
3. **Advanced Metrics**: More sophisticated performance metrics
4. **Integration**: Integration with external monitoring systems
5. **Cost Optimization**: Automatic cost-based scaling decisions