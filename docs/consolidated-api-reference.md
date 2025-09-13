# Consolidated API Reference

## Overview

This document provides comprehensive API documentation for the consolidated function endpoints, including migration guides from the previous individual function architecture.

## Base URL Structure

All consolidated APIs follow a consistent structure:
```
https://your-domain.netlify.app/api/{handler}/{resource}/{action}
```

Where:
- `{handler}`: The consolidated handler (admin, public, attempts, cache)
- `{resource}`: The resource type (exams, students, results, etc.)
- `{action}`: The specific operation (create, update, delete, etc.)

## Authentication

### Admin Endpoints
All admin endpoints require JWT authentication:
```http
Authorization: Bearer <jwt_token>
```

### Public Endpoints
Public endpoints may require:
- IP validation for restricted exams
- Student code validation
- Rate limiting compliance

## Admin API Handler (`/api/admin`)

### Exam Management

#### Get All Exams
```http
GET /api/admin/exams/list
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "exam_123",
      "title": "Mathematics Final",
      "status": "published",
      "created_at": "2024-01-15T10:00:00Z",
      "questions_count": 25,
      "attempts_count": 150
    }
  ]
}
```

**Migration from**: `GET /api/admin/exams`

#### Create Exam
```http
POST /api/admin/exams/create
Content-Type: application/json

{
  "title": "New Exam",
  "description": "Exam description",
  "settings": {
    "time_limit": 3600,
    "randomize_questions": true,
    "show_results": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "exam_456",
    "title": "New Exam",
    "status": "draft"
  }
}
```

**Migration from**: `POST /api/admin/exams`

#### Update Exam
```http
PUT /api/admin/exams/update
Content-Type: application/json

{
  "id": "exam_123",
  "title": "Updated Title",
  "settings": {
    "time_limit": 7200
  }
}
```

**Migration from**: `PUT /api/admin/exams/[id]`

#### Delete Exam
```http
DELETE /api/admin/exams/delete
Content-Type: application/json

{
  "id": "exam_123"
}
```

**Migration from**: `DELETE /api/admin/exams/[id]`

#### Publish Exam
```http
POST /api/admin/exams/publish
Content-Type: application/json

{
  "id": "exam_123"
}
```

**Migration from**: `POST /api/admin/exams/[id]/publish`

### Student Management

#### Get All Students
```http
GET /api/admin/students/list?page=1&limit=50&search=john
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `search`: Search term for name or code

**Response:**
```json
{
  "success": true,
  "data": {
    "students": [
      {
        "id": "student_123",
        "name": "John Doe",
        "code": "STU001",
        "email": "john@example.com",
        "created_at": "2024-01-10T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

**Migration from**: `GET /api/admin/students`

#### Bulk Import Students
```http
POST /api/admin/students/import
Content-Type: application/json

{
  "students": [
    {
      "name": "Jane Smith",
      "code": "STU002",
      "email": "jane@example.com"
    }
  ],
  "options": {
    "update_existing": true,
    "send_whatsapp": false
  }
}
```

**Migration from**: `POST /api/admin/students/import`

### Results Management

#### Get Exam Results
```http
GET /api/admin/results/exam?exam_id=exam_123&format=json
```

**Query Parameters:**
- `exam_id`: Required exam identifier
- `format`: Response format (json, csv, xlsx)
- `include_details`: Include question-level details (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "exam": {
      "id": "exam_123",
      "title": "Mathematics Final",
      "total_attempts": 150,
      "completed_attempts": 145
    },
    "results": [
      {
        "student_id": "student_123",
        "student_name": "John Doe",
        "score": 85,
        "percentage": 85.0,
        "completed_at": "2024-01-20T14:30:00Z",
        "time_taken": 3240
      }
    ],
    "statistics": {
      "average_score": 78.5,
      "highest_score": 98,
      "lowest_score": 45,
      "pass_rate": 82.0
    }
  }
}
```

**Migration from**: `GET /api/admin/results/[examId]`

#### Export Results
```http
POST /api/admin/results/export
Content-Type: application/json

{
  "exam_id": "exam_123",
  "format": "xlsx",
  "include_details": true,
  "filters": {
    "min_score": 70,
    "completed_only": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "download_url": "https://storage.url/exports/exam_123_results.xlsx",
    "expires_at": "2024-01-21T10:00:00Z"
  }
}
```

**Migration from**: `POST /api/admin/export/[examId]`

### Monitoring

#### System Health
```http
GET /api/admin/monitoring/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-20T15:00:00Z",
    "services": {
      "database": {
        "status": "healthy",
        "response_time": 45,
        "connections": 12
      },
      "cache": {
        "status": "healthy",
        "hit_rate": 0.85,
        "memory_usage": 0.67
      },
      "storage": {
        "status": "healthy",
        "available_space": 0.78
      }
    },
    "functions": {
      "admin_handler": {
        "status": "healthy",
        "avg_response_time": 120,
        "error_rate": 0.001
      },
      "public_handler": {
        "status": "healthy",
        "avg_response_time": 80,
        "error_rate": 0.0005
      }
    }
  }
}
```

**Migration from**: `GET /api/admin/health`

#### Performance Analytics
```http
GET /api/admin/monitoring/analytics?period=24h&metrics=response_time,error_rate
```

**Query Parameters:**
- `period`: Time period (1h, 24h, 7d, 30d)
- `metrics`: Comma-separated list of metrics to include

**Migration from**: `GET /api/admin/analytics`

## Public API Handler (`/api/public`)

### Exam Information

#### Get Exam Info
```http
GET /api/public/exam-info?exam_id=exam_123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "exam_123",
    "title": "Mathematics Final",
    "description": "Final examination for Mathematics course",
    "duration": 3600,
    "question_count": 25,
    "instructions": "Read all questions carefully...",
    "access_type": "code_required",
    "status": "active"
  }
}
```

**Caching**: 1 hour TTL with edge caching
**Migration from**: `GET /api/public/exam/[id]`

#### Validate Student Code
```http
POST /api/public/code-validation
Content-Type: application/json

{
  "exam_id": "exam_123",
  "code": "STU001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "student": {
      "name": "John Doe",
      "code": "STU001"
    },
    "exam_access": {
      "allowed": true,
      "attempt_exists": false,
      "ip_allowed": true
    }
  }
}
```

**Migration from**: `POST /api/public/validate-code`

### Results Portal

#### Get Public Results
```http
GET /api/public/results?code=STU001&exam_id=exam_123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "student": {
      "name": "John Doe",
      "code": "STU001"
    },
    "exam": {
      "title": "Mathematics Final",
      "completed_at": "2024-01-20T14:30:00Z"
    },
    "result": {
      "score": 85,
      "percentage": 85.0,
      "grade": "B+",
      "passed": true
    }
  }
}
```

**Caching**: 5 minutes TTL with tag-based invalidation
**Migration from**: `GET /api/public/results/[code]`

## Attempt API Handler (`/api/attempts/[attemptId]`)

### Attempt Management

#### Get Attempt State
```http
GET /api/attempts/attempt_123/state
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "attempt_123",
    "exam_id": "exam_123",
    "student_id": "student_123",
    "status": "in_progress",
    "started_at": "2024-01-20T13:00:00Z",
    "time_remaining": 2400,
    "current_question": 5,
    "answers": {
      "1": {"answer": "A", "saved_at": "2024-01-20T13:05:00Z"},
      "2": {"answer": ["B", "C"], "saved_at": "2024-01-20T13:08:00Z"}
    },
    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice",
        "question": "What is 2 + 2?",
        "options": ["2", "3", "4", "5"]
      }
    ]
  }
}
```

**Migration from**: `GET /api/attempts/[id]/state`

#### Save Attempt Progress
```http
POST /api/attempts/attempt_123/save
Content-Type: application/json

{
  "question_id": "q1",
  "answer": "A",
  "timestamp": "2024-01-20T13:15:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "saved": true,
    "timestamp": "2024-01-20T13:15:00Z",
    "auto_save_enabled": true
  }
}
```

**Migration from**: `POST /api/attempts/[id]/save`

#### Submit Attempt
```http
POST /api/attempts/attempt_123/submit
Content-Type: application/json

{
  "final_answers": {
    "q1": "A",
    "q2": ["B", "C"],
    "q3": "True"
  },
  "submitted_at": "2024-01-20T14:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "submitted": true,
    "score": 85,
    "percentage": 85.0,
    "completed_at": "2024-01-20T14:30:00Z",
    "show_results": true
  }
}
```

**Migration from**: `POST /api/attempts/[id]/submit`

### Real-time Features

#### Server-Sent Events
```http
GET /api/attempts/attempt_123/sse
Accept: text/event-stream
```

**Event Types:**
- `auto-save`: Automatic save confirmation
- `time-warning`: Time remaining warnings
- `connection-status`: Connection health updates
- `admin-message`: Messages from administrators

**Migration from**: `GET /api/attempts/[id]/events`

## Cache API Handler (`/api/cache`)

### Cache Management

#### Invalidate Cache
```http
POST /api/cache/invalidate
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "tags": ["exam_123", "student_data"],
  "keys": ["exam:123:info", "student:STU001:profile"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invalidated_tags": 2,
    "invalidated_keys": 2,
    "timestamp": "2024-01-20T15:00:00Z"
  }
}
```

#### Cache Analytics
```http
GET /api/cache/analytics?period=24h
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "hit_rate": 0.85,
    "miss_rate": 0.15,
    "total_requests": 15420,
    "cache_hits": 13107,
    "cache_misses": 2313,
    "top_cached_keys": [
      {
        "key": "exam:*:info",
        "hits": 3240,
        "hit_rate": 0.92
      }
    ],
    "invalidation_events": 45
  }
}
```

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "exam_id",
      "issue": "Required field missing"
    },
    "timestamp": "2024-01-20T15:00:00Z",
    "request_id": "req_123456"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Rate Limiting

### Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Admin API | 1000 requests | 1 hour |
| Public API | 100 requests | 1 hour |
| Attempt API | 500 requests | 1 hour |
| Cache API | 50 requests | 1 hour |

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
```

## Migration Guide

### Step 1: Update API Endpoints

**Before (Individual Functions):**
```javascript
// Old individual function calls
const exams = await fetch('/api/admin/exams');
const students = await fetch('/api/admin/students');
const results = await fetch('/api/admin/results/exam123');
```

**After (Consolidated Handlers):**
```javascript
// New consolidated function calls
const exams = await fetch('/api/admin/exams/list');
const students = await fetch('/api/admin/students/list');
const results = await fetch('/api/admin/results/exam?exam_id=exam123');
```

### Step 2: Update Request Formats

**Before:**
```javascript
// Old format with URL parameters
await fetch(`/api/admin/exams/${examId}`, {
  method: 'DELETE'
});
```

**After:**
```javascript
// New format with request body
await fetch('/api/admin/exams/delete', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: examId })
});
```

### Step 3: Update Error Handling

**Before:**
```javascript
// Old error handling
if (!response.ok) {
  throw new Error('Request failed');
}
```

**After:**
```javascript
// New standardized error handling
const result = await response.json();
if (!result.success) {
  throw new Error(result.error.message);
}
```

### Step 4: Implement Retry Logic

```javascript
// Recommended retry logic for consolidated handlers
async function apiCall(endpoint, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(endpoint, options);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      }
      
      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(result.error.message);
      }
      
      // Retry server errors (5xx)
      if (i === retries - 1) {
        throw new Error(result.error.message);
      }
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
}
```

## Testing

### Unit Tests
```javascript
// Test consolidated handler routing
describe('Admin API Handler', () => {
  test('routes exam requests correctly', async () => {
    const response = await request(app)
      .get('/api/admin/exams/list')
      .set('Authorization', 'Bearer valid_token')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('length');
  });
});
```

### Integration Tests
```javascript
// Test end-to-end functionality
describe('Exam Management Flow', () => {
  test('create, update, and delete exam', async () => {
    // Create exam
    const createResponse = await apiCall('/api/admin/exams/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Exam' })
    });
    
    const examId = createResponse.id;
    
    // Update exam
    await apiCall('/api/admin/exams/update', {
      method: 'PUT',
      body: JSON.stringify({ id: examId, title: 'Updated Exam' })
    });
    
    // Delete exam
    await apiCall('/api/admin/exams/delete', {
      method: 'DELETE',
      body: JSON.stringify({ id: examId })
    });
  });
});
```

This consolidated API provides improved performance, better caching, and simplified maintenance while maintaining full backward compatibility through proper migration strategies.