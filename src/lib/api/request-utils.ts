import { NextRequest } from "next/server";
import { APIRequest } from "./unified-handler";

/**
 * Utility functions for request parsing and validation
 */

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

/**
 * Parse and validate request body against schema
 */
export function validateRequestBody(body: any, rules: ValidationRule[]): ValidationResult {
  const errors: string[] = [];
  const data: any = {};

  for (const rule of rules) {
    const value = body?.[rule.field];

    // Check required fields
    if (rule.required && (value === undefined || value === null)) {
      errors.push(`Field '${rule.field}' is required`);
      continue;
    }

    // Skip validation for optional undefined fields
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    if (!validateType(value, rule.type)) {
      errors.push(`Field '${rule.field}' must be of type ${rule.type}`);
      continue;
    }

    // String validations
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.min && value.length < rule.min) {
        errors.push(`Field '${rule.field}' must be at least ${rule.min} characters`);
        continue;
      }
      if (rule.max && value.length > rule.max) {
        errors.push(`Field '${rule.field}' must be at most ${rule.max} characters`);
        continue;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`Field '${rule.field}' format is invalid`);
        continue;
      }
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`);
        continue;
      }
    }

    // Number validations
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min && value < rule.min) {
        errors.push(`Field '${rule.field}' must be at least ${rule.min}`);
        continue;
      }
      if (rule.max && value > rule.max) {
        errors.push(`Field '${rule.field}' must be at most ${rule.max}`);
        continue;
      }
    }

    // Array validations
    if (rule.type === 'array' && Array.isArray(value)) {
      if (rule.min && value.length < rule.min) {
        errors.push(`Field '${rule.field}' must have at least ${rule.min} items`);
        continue;
      }
      if (rule.max && value.length > rule.max) {
        errors.push(`Field '${rule.field}' must have at most ${rule.max} items`);
        continue;
      }
    }

    data[rule.field] = value;
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}

/**
 * Validate value type
 */
function validateType(value: any, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Parse query parameters with type conversion
 */
export function parseQueryParams(query: Record<string, string>, schema: Record<string, 'string' | 'number' | 'boolean' | 'array'>): Record<string, any> {
  const parsed: Record<string, any> = {};

  for (const [key, type] of Object.entries(schema)) {
    const value = query[key];
    if (value === undefined) continue;

    switch (type) {
      case 'string':
        parsed[key] = value;
        break;
      case 'number':
        const num = parseFloat(value);
        if (!isNaN(num)) parsed[key] = num;
        break;
      case 'boolean':
        parsed[key] = value === 'true' || value === '1';
        break;
      case 'array':
        parsed[key] = value.split(',').map(v => v.trim()).filter(v => v);
        break;
    }
  }

  return parsed;
}

/**
 * Extract path parameters from dynamic routes
 */
export function extractPathParams(requestPath: string[], routePattern: string[]): Record<string, string> {
  const params: Record<string, string> = {};

  for (let i = 0; i < routePattern.length; i++) {
    const patternSegment = routePattern[i];
    
    if (patternSegment.startsWith('[') && patternSegment.endsWith(']')) {
      const paramName = patternSegment.slice(1, -1);
      params[paramName] = requestPath[i] || '';
    }
  }

  return params;
}

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Parse pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(query: Record<string, string>, defaultLimit = 20, maxLimit = 100): PaginationParams {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit || defaultLimit.toString(), 10) || defaultLimit));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parse sorting parameters
 */
export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

export function parseSort(query: Record<string, string>, allowedFields: string[], defaultField = 'created_at'): SortParams {
  const sortBy = query.sort || defaultField;
  const sortOrder = query.order === 'desc' ? 'desc' : 'asc';
  
  // Validate field is allowed
  const field = allowedFields.includes(sortBy) ? sortBy : defaultField;
  
  return {
    field,
    direction: sortOrder
  };
}

/**
 * Create standardized API response
 */
export function createResponse(data: any, status = 200): { data: any; status: number } {
  return { data, status };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(error: string, status = 400): { error: string; status: number } {
  return { error, status };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse(
  items: any[],
  total: number,
  pagination: PaginationParams
): { data: any; status: number } {
  const totalPages = Math.ceil(total / pagination.limit);
  
  return {
    data: {
      items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1
      }
    },
    status: 200
  };
}