# Real-time Attempt Features Documentation

## Overview

This document describes the real-time attempt management features implemented as part of the Netlify Functions optimization project. These features provide WebSocket-like functionality, auto-save optimization, and conflict resolution for exam attempts.

## Architecture

### Components

1. **RealtimeAttemptManager** (`src/lib/api/realtime-attempt.ts`)
   - Core class managing real-time operations
   - Handles auto-save, synchronization, and conflict resolution
   - Provides connection management and statistics

2. **Server-Sent Events Endpoint** (`src/app/api/attempts/[attemptId]/sse/route.ts`)
   - Provides real-time communication channel
   - Implements heartbeat and connection management
   - Supports CORS for cross-origin requests

3. **React Hook** (`src/hooks/useRealtimeAttempt.ts`)
   - Client-side integration for real-time features
   - Manages auto-save intervals and conflict resolution
   - Provides easy-to-use API for components

4. **Monitoring Component** (`src/components/RealtimeAttemptMonitor.tsx`)
   - Admin dashboard for real-time monitoring
   - Shows active attempts and performance metrics
   - Real-time updates of system statistics

5. **Database RPC Functions** (`db/realtime_rpcs.sql`)
   - Optimized database operations for real-time features
   - Batch conflict resolution and performance metrics
   - Connection cleanup and heartbeat management

## Features

### 1. Auto-Save Optimization

**Purpose**: Automatically save student progress with minimal server load and conflict resolution.

**Key Features**:
- Configurable save intervals (default: 5 seconds)
- Batch processing of changes
- Exponential backoff on failures
- Conflict detection and resolution

**Usage**:
```typescript
import { useRealtimeAttempt } from '@/hooks/useRealtimeAttempt';

const { saveAnswer, state } = useRealtimeAttempt({
  attemptId: 'attempt-uuid',
  autoSaveInterval: 5000,
  conflictStrategy: 'merge'
});

// Save an answer
saveAnswer('question-1', 'answer-value');

// Check sync status
console.log('Syncing:', state.syncing);
console.log('Pending changes:', state.pendingChanges);
```

### 2. Real-time Synchronization

**Purpose**: Keep client and server state synchronized with conflict resolution.

**Key Features**:
- Version-based conflict detection
- Multiple conflict resolution strategies (merge, local, server)
- Automatic retry with exponential backoff
- Real-time status updates

**Conflict Resolution Strategies**:
- **merge**: Prefer local changes, fallback to server
- **local**: Always use local changes
- **server**: Always use server changes

### 3. Server-Sent Events (SSE)

**Purpose**: Provide real-time communication without WebSocket complexity.

**Key Features**:
- Automatic connection management
- Heartbeat for connection health
- Graceful reconnection on failures
- CORS support for cross-origin requests

**Usage**:
```javascript
// Connect to SSE endpoint
const eventSource = new EventSource('/api/attempts/attempt-id/sse?connectionId=conn-123');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};
```

### 4. Connection Management

**Purpose**: Track and manage real-time connections efficiently.

**Key Features**:
- Connection lifecycle management
- Automatic cleanup of stale connections
- Performance metrics and statistics
- Connection health monitoring

## API Reference

### RealtimeAttemptManager

#### Methods

##### `initializeRealtimeMonitoring(attemptId, connectionId)`
Initialize real-time monitoring for an attempt.

**Parameters**:
- `attemptId` (string): UUID of the exam attempt
- `connectionId` (string): Unique connection identifier

**Returns**: Promise<void>

##### `optimizedAutoSave(attemptId, changes, config)`
Perform optimized auto-save with batching and conflict resolution.

**Parameters**:
- `attemptId` (string): UUID of the exam attempt
- `changes` (AttemptChange[]): Array of changes to save
- `config` (RealtimeConfig): Configuration options

**Returns**: Promise<SyncResult>

##### `synchronizeAttempt(attemptId, localVersion, localChanges)`
Synchronize attempt with conflict resolution.

**Parameters**:
- `attemptId` (string): UUID of the exam attempt
- `localVersion` (number): Client's current version
- `localChanges` (AttemptChange[]): Local changes to sync

**Returns**: Promise<SyncResult>

### useRealtimeAttempt Hook

#### Configuration

```typescript
interface RealtimeAttemptConfig {
  attemptId: string;
  autoSaveInterval?: number; // Default: 5000ms
  maxRetries?: number; // Default: 3
  conflictStrategy?: 'merge' | 'local' | 'server'; // Default: 'merge'
  enableSSE?: boolean; // Default: true
}
```

#### State

```typescript
interface RealtimeAttemptState {
  connected: boolean;
  syncing: boolean;
  lastSync?: Date;
  pendingChanges: number;
  conflicts: Array<{
    questionId: string;
    localValue: any;
    serverValue: any;
  }>;
  error?: string;
}
```

#### Methods

- `saveAnswer(questionId, value)`: Save an answer with auto-save
- `saveAutoSaveData(questionId, value)`: Save auto-save data
- `logActivity(activityType, data)`: Log activity event
- `forceSave()`: Force immediate save of pending changes
- `forceSync()`: Force synchronization with server
- `resolveConflict(questionId, resolution, localValue, serverValue)`: Resolve a conflict

## Database Schema

### attempt_activity_events

Stores real-time activity events for attempts.

```sql
CREATE TABLE attempt_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_time timestamptz NOT NULL DEFAULT NOW(),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
```

### Key RPC Functions

1. **get_attempt_sync_status(uuid)**: Get synchronization status
2. **batch_resolve_attempt_conflicts(jsonb)**: Batch resolve conflicts
3. **get_realtime_attempt_activity(uuid, timestamptz, integer)**: Get activity feed
4. **update_attempt_heartbeat(uuid, text)**: Update connection heartbeat
5. **get_attempt_connection_stats(uuid)**: Get connection statistics
6. **cleanup_stale_attempt_connections(integer)**: Clean up stale connections
7. **get_realtime_performance_metrics(integer)**: Get performance metrics

## Performance Considerations

### Optimization Strategies

1. **Batching**: Changes are batched to reduce database calls
2. **Caching**: Frequently accessed data is cached with appropriate TTL
3. **Connection Pooling**: Database connections are reused efficiently
4. **Circuit Breaker**: Automatic failover for database issues

### Metrics

- **Auto-save success rate**: Percentage of successful auto-saves
- **Average sync latency**: Time taken for synchronization operations
- **Conflict resolution rate**: Number of conflicts resolved per hour
- **Active connections**: Current number of real-time connections

## Error Handling

### Common Errors

1. **Connection Lost**: Automatic reconnection with exponential backoff
2. **Version Mismatch**: Conflict resolution with configurable strategies
3. **Network Timeout**: Retry with exponential backoff
4. **Database Error**: Circuit breaker pattern with fallback

### Error Recovery

- Automatic retry for transient failures
- Graceful degradation when real-time features fail
- Fallback to regular save operations
- User notification of sync issues

## Monitoring and Debugging

### Admin Dashboard

The `RealtimeAttemptMonitor` component provides:
- Real-time statistics
- Active attempt monitoring
- Performance metrics
- Connection health status

### Logging

All real-time operations are logged to `attempt_activity_events` table:
- Connection events
- Auto-save operations
- Conflict resolutions
- Error conditions

### Performance Metrics

Available through the admin dashboard:
- Response times
- Success rates
- Connection statistics
- Error rates

## Security Considerations

### Authentication

- All real-time operations require valid attempt access
- Connection IDs are generated securely
- Rate limiting prevents abuse

### Data Validation

- Input validation on all real-time endpoints
- Sanitization of user-provided data
- Version checking prevents data corruption

### Privacy

- Real-time data is scoped to individual attempts
- No cross-attempt data leakage
- Secure connection management

## Deployment

### Requirements

1. Database RPC functions must be deployed
2. Real-time endpoints must be accessible
3. CORS configuration for SSE endpoints
4. Environment variables for Supabase connection

### Setup Steps

1. Apply database RPC functions:
   ```bash
   node scripts/setup-realtime-rpcs.js
   ```

2. Test real-time functionality:
   ```bash
   node scripts/test-realtime-functions.js
   ```

3. Configure monitoring dashboard in admin interface

### Environment Variables

Required for full functionality:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for RPC functions

## Future Enhancements

### Planned Features

1. **WebSocket Support**: Full WebSocket implementation for lower latency
2. **Collaborative Editing**: Multiple users editing same attempt
3. **Real-time Notifications**: Push notifications for important events
4. **Advanced Analytics**: Detailed performance and usage analytics

### Scalability Improvements

1. **Redis Integration**: Distributed caching and session management
2. **Load Balancing**: Multiple server instances with shared state
3. **Database Sharding**: Horizontal scaling for large deployments
4. **CDN Integration**: Edge caching for global performance

## Troubleshooting

### Common Issues

1. **SSE Connection Fails**
   - Check CORS configuration
   - Verify network connectivity
   - Check browser console for errors

2. **Auto-save Not Working**
   - Verify attempt ID is valid
   - Check database connectivity
   - Review error logs in browser console

3. **Conflicts Not Resolving**
   - Check conflict resolution strategy
   - Verify version numbers are correct
   - Review server logs for errors

### Debug Tools

1. Browser developer tools for SSE monitoring
2. Database logs for RPC function errors
3. Admin dashboard for real-time statistics
4. Network tab for API request monitoring

## Conclusion

The real-time attempt features provide a robust foundation for synchronized exam taking with automatic conflict resolution and performance optimization. The implementation follows best practices for scalability, security, and maintainability while providing a smooth user experience for students taking exams.