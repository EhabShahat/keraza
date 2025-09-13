/**
 * Cache integration utilities for API routes
 * Demonstrates how to integrate intelligent caching into existing endpoints
 */

import { intelligentCacheManager } from './cache-manager';
import { CacheWarmingUtils } from './cache-warming';
import { CacheInvalidationUtils } from './cache-utils';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Cached data fetchers for common operations
 */
export class CachedDataFetchers {
  /**
   * Get system configuration with intelligent caching
   */
  static async getSystemConfig(): Promise<any> {
    return intelligentCacheManager.getWithStrategy(
      'SYSTEM_CONFIG',
      { type: 'system' },
      async () => {
        const client = supabaseServer();
        const { data } = await client
          .from('app_config')
          .select('*')
          .maybeSingle();
        return data;
      }
    );
  }

  /**
   * Get app settings with intelligent caching
   */
  static async getAppSettings(): Promise<any> {
    return intelligentCacheManager.getWithStrategy(
      'APP_SETTINGS',
      { key: 'app-settings' },
      async () => {
        const client = supabaseServer();
        const { data } = await client
          .from('app_config')
          .select('key, value')
          .in('key', ['system_mode', 'system_disabled_message', 'whatsapp_enabled']);
        return data;
      }
    );
  }

  /**
   * Get active exams with intelligent caching
   */
  static async getActiveExams(): Promise<any> {
    return intelligentCacheManager.getWithStrategy(
      'ACTIVE_EXAMS',
      {},
      async () => {
        const client = supabaseServer();
        const { data } = await client
          .from('exams')
          .select('id, title, status, start_time, end_time, access_type, created_at')
          .eq('status', 'published')
          .order('start_time', { ascending: true });
        return data;
      }
    );
  }

  /**
   * Get exam details with intelligent caching
   */
  static async getExamDetails(examId: string, includeQuestions: boolean = false): Promise<any> {
    // Check if exam has active attempts to determine caching strategy
    const hasActiveAttempts = await CachedDataFetchers.checkActiveAttempts(examId);
    
    return intelligentCacheManager.getWithStrategy(
      'EXAM_INFO',
      { examId, includeQuestions },
      async () => {
        const client = supabaseServer();
        
        let query = client
          .from('exams')
          .select(includeQuestions ? `
            *,
            questions (
              id, type, question_text, options, correct_answer, points, order_index
            )
          ` : '*')
          .eq('id', examId);

        const { data } = await query.single();
        return data;
      },
      { hasActiveAttempts }
    );
  }

  /**
   * Get student information with intelligent caching
   */
  static async getStudentInfo(studentCode: string, examId?: string): Promise<any> {
    return intelligentCacheManager.getWithStrategy(
      'STUDENT_INFO',
      { studentCode, examId },
      async () => {
        const client = supabaseServer();
        
        if (examId) {
          // Get student with exam-specific data
          const { data } = await client
            .from('students')
            .select(`
              *,
              student_exam_attempts!inner (
                id, exam_id, status, created_at
              )
            `)
            .eq('code', studentCode)
            .eq('student_exam_attempts.exam_id', examId)
            .single();
          return data;
        } else {
          // Get basic student info
          const { data } = await client
            .from('students')
            .select('*')
            .eq('code', studentCode)
            .single();
          return data;
        }
      }
    );
  }

  /**
   * Get attempt state with intelligent caching
   */
  static async getAttemptState(attemptId: string): Promise<any> {
    // Check if attempt is currently active
    const isActive = await CachedDataFetchers.checkAttemptActive(attemptId);
    
    return intelligentCacheManager.getWithStrategy(
      'ATTEMPT_STATE',
      { attemptId, type: 'state' },
      async () => {
        const client = supabaseServer();
        const { data } = await client
          .from('exam_attempts')
          .select(`
            *,
            exam:exams (
              id, title, time_limit, questions_count
            )
          `)
          .eq('id', attemptId)
          .single();
        return data;
      },
      { isActive }
    );
  }

  /**
   * Validate student code with intelligent caching
   */
  static async validateStudentCode(code: string, examId: string): Promise<any> {
    return intelligentCacheManager.getWithStrategy(
      'CODE_VALIDATION',
      { code, examId },
      async () => {
        const client = supabaseServer();
        
        // Check if student exists and can access exam
        const { data: student } = await client
          .from('students')
          .select('id, code, name')
          .eq('code', code)
          .single();

        if (!student) {
          return { valid: false, reason: 'Student not found' };
        }

        // Check if student already has an attempt
        const { data: existingAttempt } = await client
          .from('student_exam_attempts')
          .select('id, status')
          .eq('student_code', code)
          .eq('exam_id', examId)
          .maybeSingle();

        if (existingAttempt) {
          return { 
            valid: false, 
            reason: 'Student already has an attempt',
            attemptId: existingAttempt.id 
          };
        }

        return { 
          valid: true, 
          student: {
            id: student.id,
            code: student.code,
            name: student.name
          }
        };
      }
    );
  }

  /**
   * Get analytics data with intelligent caching
   */
  static async getAnalyticsData(type: string, examId?: string, dateRange?: string): Promise<any> {
    return intelligentCacheManager.getWithStrategy(
      'ANALYTICS_DATA',
      { type, examId, dateRange },
      async () => {
        const client = supabaseServer();
        
        switch (type) {
          case 'exam-summary':
            if (!examId) throw new Error('Exam ID required for exam summary');
            
            const { data } = await client
              .from('student_exam_summary')
              .select('*')
              .eq('exam_id', examId);
            return data;

          case 'system-overview':
            const [examsCount, studentsCount, attemptsCount] = await Promise.all([
              client.from('exams').select('*', { count: 'exact', head: true }),
              client.from('students').select('*', { count: 'exact', head: true }),
              client.from('exam_attempts').select('*', { count: 'exact', head: true })
            ]);

            return {
              exams: examsCount.count || 0,
              students: studentsCount.count || 0,
              attempts: attemptsCount.count || 0
            };

          default:
            throw new Error(`Unknown analytics type: ${type}`);
        }
      }
    );
  }

  /**
   * Check if exam has active attempts
   */
  private static async checkActiveAttempts(examId: string): Promise<boolean> {
    const client = supabaseServer();
    const { count } = await client
      .from('exam_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('exam_id', examId)
      .eq('status', 'in_progress');
    
    return (count || 0) > 0;
  }

  /**
   * Check if attempt is currently active
   */
  private static async checkAttemptActive(attemptId: string): Promise<boolean> {
    const client = supabaseServer();
    const { data } = await client
      .from('exam_attempts')
      .select('status, updated_at')
      .eq('id', attemptId)
      .single();
    
    if (!data) return false;
    
    // Consider active if status is in_progress and updated within last 5 minutes
    const lastUpdate = new Date(data.updated_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    return data.status === 'in_progress' && lastUpdate > fiveMinutesAgo;
  }
}

/**
 * Cache integration middleware for API routes
 */
export class CacheMiddleware {
  /**
   * Wrap API handler with intelligent caching
   */
  static withCache<T>(
    dataType: string,
    keyExtractor: (request: any) => any,
    handler: (request: any) => Promise<T>,
    options?: {
      contextExtractor?: (request: any) => any;
      shouldCache?: (data: T, context?: any) => boolean;
    }
  ) {
    return async (request: any): Promise<T> => {
      const params = keyExtractor(request);
      const context = options?.contextExtractor?.(request);
      
      return intelligentCacheManager.getWithStrategy(
        dataType,
        params,
        () => handler(request),
        context
      );
    };
  }

  /**
   * Invalidate cache after data mutations
   */
  static async invalidateAfterMutation(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    oldRecord?: any,
    newRecord?: any
  ): Promise<void> {
    await CacheInvalidationUtils.invalidateForDataChange(
      table,
      operation,
      oldRecord,
      newRecord
    );
  }

  /**
   * Warm cache before high-traffic events
   */
  static async warmForEvent(eventType: 'exam-start' | 'student-login', params: any): Promise<void> {
    switch (eventType) {
      case 'exam-start':
        if (params.examId) {
          await CacheWarmingUtils.warmExamCache(params.examId);
        }
        break;
        
      case 'student-login':
        if (params.studentCode) {
          await CacheWarmingUtils.warmStudentCache(params.studentCode, params.examId);
        }
        break;
    }
  }
}

/**
 * Example usage in API routes
 */
export class CacheIntegrationExamples {
  /**
   * Example: Cached exam list endpoint
   */
  static async getExamsWithCache() {
    return CacheMiddleware.withCache(
      'ACTIVE_EXAMS',
      () => ({}), // No parameters needed for active exams
      async () => {
        return CachedDataFetchers.getActiveExams();
      }
    )({});
  }

  /**
   * Example: Cached exam details endpoint
   */
  static async getExamWithCache(examId: string, includeQuestions: boolean = false) {
    return CacheMiddleware.withCache(
      'EXAM_INFO',
      (req) => ({ examId: req.examId, includeQuestions: req.includeQuestions }),
      async (req) => {
        return CachedDataFetchers.getExamDetails(req.examId, req.includeQuestions);
      },
      {
        contextExtractor: async (req) => ({
          hasActiveAttempts: await CachedDataFetchers['checkActiveAttempts'](req.examId)
        })
      }
    )({ examId, includeQuestions });
  }

  /**
   * Example: Cached student validation
   */
  static async validateStudentWithCache(code: string, examId: string) {
    return CacheMiddleware.withCache(
      'CODE_VALIDATION',
      (req) => ({ code: req.code, examId: req.examId }),
      async (req) => {
        return CachedDataFetchers.validateStudentCode(req.code, req.examId);
      }
    )({ code, examId });
  }
}

export { CachedDataFetchers, CacheMiddleware };