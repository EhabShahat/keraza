import { APIRequest, APIResponse, Middleware } from "./unified-handler";
import { getClientIp } from "@/lib/ip";
import { validateCodeFormat, getCodeFormatSettings } from "@/lib/codeGenerator";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator: (request: APIRequest) => string; // Function to generate rate limit key
}

/**
 * In-memory rate limiter
 */
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  
  constructor(private config: RateLimitConfig) {}
  
  /**
   * Check if request is within rate limit
   */
  isAllowed(request: APIRequest): boolean {
    const key = this.config.keyGenerator(request);
    const now = Date.now();
    
    // Clean up expired entries
    this.cleanup(now);
    
    const entry = this.requests.get(key);
    
    if (!entry) {
      // First request from this key
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return true;
    }
    
    if (now > entry.resetTime) {
      // Window has expired, reset
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return true;
    }
    
    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return false;
    }
    
    // Increment count
    entry.count++;
    return true;
  }
  
  /**
   * Get remaining requests for a key
   */
  getRemaining(request: APIRequest): number {
    const key = this.config.keyGenerator(request);
    const entry = this.requests.get(key);
    
    if (!entry || Date.now() > entry.resetTime) {
      return this.config.maxRequests;
    }
    
    return Math.max(0, this.config.maxRequests - entry.count);
  }
  
  /**
   * Get reset time for a key
   */
  getResetTime(request: APIRequest): number {
    const key = this.config.keyGenerator(request);
    const entry = this.requests.get(key);
    
    if (!entry || Date.now() > entry.resetTime) {
      return Date.now() + this.config.windowMs;
    }
    
    return entry.resetTime;
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(now: number): void {
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

/**
 * Rate limit configurations for different endpoints
 */
const RATE_LIMITS = {
  // General public API rate limit
  general: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute per IP
    keyGenerator: (request) => getClientIp(request.headers as any) || 'unknown'
  }),
  
  // Code validation - more restrictive
  codeValidation: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute per IP
    keyGenerator: (request) => getClientIp(request.headers as any) || 'unknown'
  }),
  
  // Results search - more restrictive
  resultsSearch: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute per IP
    keyGenerator: (request) => getClientIp(request.headers as any) || 'unknown'
  }),
  
  // Exam access - very restrictive
  examAccess: new RateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10, // 10 attempts per 5 minutes per IP
    keyGenerator: (request) => getClientIp(request.headers as any) || 'unknown'
  })
};

/**
 * IP tracking and geographic restrictions
 */
class IPTracker {
  private static instance: IPTracker;
  private accessLog = new Map<string, { count: number; lastAccess: number; locations: string[] }>();
  
  static getInstance(): IPTracker {
    if (!IPTracker.instance) {
      IPTracker.instance = new IPTracker();
    }
    return IPTracker.instance;
  }
  
  /**
   * Track IP access
   */
  trackAccess(ip: string, location?: string): void {
    const now = Date.now();
    const entry = this.accessLog.get(ip);
    
    if (!entry) {
      this.accessLog.set(ip, {
        count: 1,
        lastAccess: now,
        locations: location ? [location] : []
      });
    } else {
      entry.count++;
      entry.lastAccess = now;
      if (location && !entry.locations.includes(location)) {
        entry.locations.push(location);
      }
    }
  }
  
  /**
   * Check if IP is suspicious (multiple locations, high frequency)
   */
  isSuspicious(ip: string): boolean {
    const entry = this.accessLog.get(ip);
    if (!entry) return false;
    
    // Check for multiple geographic locations
    if (entry.locations.length > 3) {
      return true;
    }
    
    // Check for high frequency access
    const hourAgo = Date.now() - (60 * 60 * 1000);
    if (entry.lastAccess > hourAgo && entry.count > 200) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get access statistics for IP
   */
  getStats(ip: string) {
    return this.accessLog.get(ip) || { count: 0, lastAccess: 0, locations: [] };
  }
}

/**
 * Code format validation middleware
 */
export function createCodeValidationMiddleware(): Middleware {
  return {
    name: 'code-validation',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      // Only validate routes that use codes
      const needsCodeValidation = [
        'validate-code',
        'exams/by-code'
      ].some(pattern => {
        if (pattern.includes('/')) {
          return request.path.join('/').includes(pattern);
        }
        return request.path.includes(pattern);
      });
      
      if (!needsCodeValidation) {
        return request;
      }
      
      const code = request.query.code?.trim();
      if (!code) {
        return request; // Let the handler deal with missing codes
      }
      
      try {
        const codeSettings = await getCodeFormatSettings();
        if (!validateCodeFormat(code, codeSettings)) {
          return {
            error: "Invalid code format",
            status: 400
          };
        }
      } catch (error) {
        console.error("Code validation error:", error);
        // Don't block on validation errors, let the handler deal with it
      }
      
      return request;
    }
  };
}

/**
 * Rate limiting middleware
 */
export function createRateLimitMiddleware(): Middleware {
  return {
    name: 'rate-limiting',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      let rateLimiter = RATE_LIMITS.general;
      
      // Choose appropriate rate limiter based on endpoint
      const path = request.path.join('/');
      if (path.includes('validate-code')) {
        rateLimiter = RATE_LIMITS.codeValidation;
      } else if (path.includes('results')) {
        rateLimiter = RATE_LIMITS.resultsSearch;
      } else if (path.includes('access')) {
        rateLimiter = RATE_LIMITS.examAccess;
      }
      
      if (!rateLimiter.isAllowed(request)) {
        const resetTime = rateLimiter.getResetTime(request);
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        
        return {
          error: "Rate limit exceeded",
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': rateLimiter['config'].maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toString()
          }
        };
      }
      
      // Add rate limit headers to successful requests
      const remaining = rateLimiter.getRemaining(request);
      const resetTime = rateLimiter.getResetTime(request);
      
      (request as any).rateLimitHeaders = {
        'X-RateLimit-Limit': rateLimiter['config'].maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toString()
      };
      
      return request;
    }
  };
}

/**
 * IP tracking and geographic restrictions middleware
 */
export function createIPTrackingMiddleware(): Middleware {
  return {
    name: 'ip-tracking',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      const ip = getClientIp(request.headers as any);
      if (!ip) {
        return request;
      }
      
      const tracker = IPTracker.getInstance();
      
      // Check if IP is suspicious
      if (tracker.isSuspicious(ip)) {
        console.warn(`Suspicious IP detected: ${ip}`, tracker.getStats(ip));
        
        // For now, just log. In production, you might want to block or require additional verification
        (request as any).suspiciousIP = true;
      }
      
      // Track this access
      tracker.trackAccess(ip);
      
      // Add IP info to request for handlers to use
      (request as any).clientIP = ip;
      
      return request;
    }
  };
}

/**
 * Student lookup and validation utilities
 */
export class StudentValidator {
  /**
   * Validate student code and return student info
   */
  static async validateStudentCode(code: string): Promise<{ valid: boolean; student?: any; reason?: string }> {
    try {
      // Validate code format first
      const codeSettings = await getCodeFormatSettings();
      if (!validateCodeFormat(code, codeSettings)) {
        return { valid: false, reason: "format" };
      }
      
      const svc = supabaseServer();
      
      // Find student by code
      const { data: student, error } = await svc
        .from("students")
        .select("id, student_name, code, mobile_number")
        .eq("code", code)
        .single();
      
      if (error) {
        if (error.code === "PGRST116") { // No rows returned
          return { valid: false, reason: "not_found" };
        }
        throw error;
      }
      
      return { valid: true, student };
    } catch (error) {
      console.error("Student validation error:", error);
      return { valid: false, reason: "error" };
    }
  }
  
  /**
   * Check if student has already attempted an exam
   */
  static async hasAttempted(studentId: string, examId: string): Promise<boolean> {
    try {
      const svc = supabaseServer();
      
      const { count, error } = await svc
        .from("student_exam_attempts")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("exam_id", examId);
      
      if (error) {
        console.error("Attempt check error:", error);
        return false; // Assume no attempt on error
      }
      
      return (count ?? 0) > 0;
    } catch (error) {
      console.error("Attempt check error:", error);
      return false;
    }
  }
}

/**
 * Abuse prevention middleware
 */
export function createAbusePreventionMiddleware(): Middleware {
  return {
    name: 'abuse-prevention',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      const ip = getClientIp(request.headers as any);
      if (!ip) {
        return request;
      }
      
      // Check for blocked IPs, names, or mobile numbers (Easter Egg feature)
      try {
        const svc = supabaseServer();
        
        // Check if IP is blocked
        const { data: blockedIP, error: ipError } = await svc
          .from("blocked_entries")
          .select("value, reason")
          .eq("type", "ip")
          .eq("value", ip)
          .single();
        
        if (blockedIP && !ipError) {
          return {
            error: "access_denied",
            data: { message: blockedIP.reason || "Access has been restricted for this IP address." },
            status: 403
          };
        }
        
        // For POST requests (like exam access), check student name and mobile if provided
        if (request.method === 'POST' && request.body) {
          const { studentName, code } = request.body;
          
          // Check blocked student name
          if (studentName) {
            const { data: blockedName, error: nameError } = await svc
              .from("blocked_entries")
              .select("value, reason")
              .eq("type", "name")
              .ilike("value", studentName.trim())
              .single();
            
            if (blockedName && !nameError) {
              return {
                error: "access_denied",
                data: { message: blockedName.reason || "Access has been restricted for this name." },
                status: 403
              };
            }
          }
          
          // Check blocked mobile number if code is provided
          if (code) {
            const studentValidation = await StudentValidator.validateStudentCode(code);
            if (studentValidation.valid && studentValidation.student?.mobile_number) {
              const { data: blockedMobile, error: mobileError } = await svc
                .from("blocked_entries")
                .select("value, reason")
                .eq("type", "mobile")
                .eq("value", studentValidation.student.mobile_number.trim())
                .single();
              
              if (blockedMobile && !mobileError) {
                return {
                  error: "access_denied",
                  data: { message: blockedMobile.reason || "Access has been restricted for this mobile number." },
                  status: 403
                };
              }
            }
          }
        }
      } catch (error) {
        console.error("Abuse prevention check error:", error);
        // Don't block on errors, just log them
      }
      
      return request;
    }
  };
}

/**
 * Security headers middleware
 */
export function createSecurityHeadersMiddleware(): Middleware {
  return {
    name: 'security-headers',
    handler: async (request: APIRequest): Promise<APIRequest> => {
      // Add security headers to be included in response
      (request as any).securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'",
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
      };
      
      return request;
    }
  };
}

/**
 * Request validation middleware
 */
export function createRequestValidationMiddleware(): Middleware {
  return {
    name: 'request-validation',
    handler: async (request: APIRequest): Promise<APIRequest | APIResponse> => {
      // Validate request size
      if (request.body && JSON.stringify(request.body).length > 10000) { // 10KB limit
        return {
          error: "Request body too large",
          status: 413
        };
      }
      
      // Validate query parameters
      for (const [key, value] of Object.entries(request.query)) {
        if (typeof value === 'string' && value.length > 1000) { // 1KB limit per param
          return {
            error: `Query parameter '${key}' too long`,
            status: 400
          };
        }
      }
      
      // Basic XSS prevention in query params
      for (const [key, value] of Object.entries(request.query)) {
        if (typeof value === 'string' && /<script|javascript:|data:/i.test(value)) {
          return {
            error: `Invalid characters in query parameter '${key}'`,
            status: 400
          };
        }
      }
      
      return request;
    }
  };
}