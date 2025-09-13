/**
 * Optimized Database Queries
 * Pre-optimized queries for common operations with caching and batching
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { queryOptimizer } from './query-optimizer';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class OptimizedQueries {
  private static instance: OptimizedQueries;
  private queryCache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): OptimizedQueries {
    if (!OptimizedQueries.instance) {
      OptimizedQueries.instance = new OptimizedQueries();
    }
    return OptimizedQueries.instance;
  }

  /**
   * Get cached result or execute query
   */
  private async getCachedOrExecute<T>(
    cacheKey: string,
    queryFn: () => Promise<{ data: T; error: any }>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<{ data: T; error: any }> {
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return { data: cached.data, error: null };
    }

    const result = await queryFn();
    
    if (!result.error && result.data) {
      this.queryCache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
        ttl
      });
    }

    return result;
  }

  /**
   * Optimized exam queries
   */
  async getPublishedExams(client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    return this.getCachedOrExecute(
      'published_exams',
      () => queryOptimizer.executeQuery(
        supabase,
        (client) => client
          .from('exams')
          .select('id, title, description, access_type, start_time, end_time, duration_minutes, status, settings')
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        'get_published_exams'
      ),
      2 * 60 * 1000 // 2 minutes TTL
    );
  }

  async getExamById(examId: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    return this.getCachedOrExecute(
      `exam_${examId}`,
      () => queryOptimizer.executeQuery(
        supabase,
        (client) => client
          .from('exams')
          .select('*')
          .eq('id', examId)
          .single(),
        'get_exam_by_id'
      ),
      5 * 60 * 1000 // 5 minutes TTL
    );
  }

  async getExamWithQuestions(examId: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    return this.getCachedOrExecute(
      `exam_with_questions_${examId}`,
      () => queryOptimizer.executeQuery(
        supabase,
        (client) => client
          .from('exams')
          .select(`
            *,
            questions (
              id, question_text, question_type, options, points, 
              required, order_index, correct_answers, question_image_url, 
              option_image_urls, created_at
            )
          `)
          .eq('id', examId)
          .single(),
        'get_exam_with_questions'
      ),
      10 * 60 * 1000 // 10 minutes TTL
    );
  }

  /**
   * Optimized student queries
   */
  async getStudentByCode(code: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    return this.getCachedOrExecute(
      `student_${code}`,
      () => queryOptimizer.executeQuery(
        supabase,
        (client) => client
          .from('students')
          .select('id, code, student_name, mobile_number')
          .eq('code', code)
          .single(),
        'get_student_by_code'
      ),
      30 * 60 * 1000 // 30 minutes TTL
    );
  }

  async getStudentAttempts(studentId: string, examId?: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    const cacheKey = examId ? `student_attempts_${studentId}_${examId}` : `student_attempts_${studentId}`;
    
    return queryOptimizer.executeQuery(
      supabase,
      (client) => {
        let query = client
          .from('student_exam_attempts')
          .select(`
            id, exam_id, attempt_id, started_at, completed_at, status,
            exams!inner(id, title, status)
          `)
          .eq('student_id', studentId);
        
        if (examId) {
          query = query.eq('exam_id', examId);
        }
        
        return query.order('started_at', { ascending: false });
      },
      'get_student_attempts'
    );
  }

  /**
   * Optimized attempt queries
   */
  async getAttemptWithDetails(attemptId: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    return queryOptimizer.executeQuery(
      supabase,
      (client) => client
        .from('exam_attempts')
        .select(`
          *,
          exams!inner(id, title, description, duration_minutes, settings),
          students(id, code, student_name, mobile_number),
          exam_results(total_questions, correct_count, score_percentage, 
                      auto_points, manual_points, max_points, final_score_percentage)
        `)
        .eq('id', attemptId)
        .single(),
      'get_attempt_with_details'
    );
  }

  async getExamAttempts(examId: string, limit: number = 100, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    return queryOptimizer.executeQuery(
      supabase,
      (client) => client
        .from('exam_attempts')
        .select(`
          id, started_at, submitted_at, completion_status, ip_address, student_name,
          students(code, student_name, mobile_number),
          exam_results(score_percentage, final_score_percentage)
        `)
        .eq('exam_id', examId)
        .order('started_at', { ascending: false })
        .limit(limit),
      'get_exam_attempts'
    );
  }

  /**
   * Optimized settings queries
   */
  async getAppSettings(client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    return this.getCachedOrExecute(
      'app_settings',
      () => queryOptimizer.executeQuery(
        supabase,
        (client) => client
          .from('app_config')
          .select('key, value, description'),
        'get_app_settings'
      ),
      10 * 60 * 1000 // 10 minutes TTL
    );
  }

  /**
   * Batch operations for bulk data processing
   */
  async batchInsertStudents(students: any[], client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    // Process in chunks to avoid query size limits
    const chunkSize = 100;
    const results = [];
    
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      
      const result = await queryOptimizer.executeQuery(
        supabase,
        (client) => client
          .from('students')
          .insert(chunk)
          .select('*'),
        'batch_insert_students'
      );
      
      results.push(result);
    }
    
    return results;
  }

  async batchUpdateAttempts(updates: { id: string; data: any }[], client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const promises = updates.map(update =>
      queryOptimizer.executeQuery(
        supabase,
        (client) => client
          .from('exam_attempts')
          .update(update.data)
          .eq('id', update.id),
        'batch_update_attempts'
      )
    );
    
    return Promise.all(promises);
  }

  /**
   * Optimized RPC calls with caching
   */
  async callRPCWithCache<T>(
    rpcName: string,
    params: any,
    ttl: number = this.DEFAULT_TTL,
    client?: SupabaseClient
  ): Promise<{ data: T; error: any }> {
    const supabase = client || queryOptimizer.getOptimizedClient();
    const cacheKey = `rpc_${rpcName}_${JSON.stringify(params)}`;
    
    return this.getCachedOrExecute(
      cacheKey,
      () => queryOptimizer.executeQuery(
        supabase,
        (client) => client.rpc(rpcName, params),
        `rpc_${rpcName}`
      ),
      ttl
    );
  }

  /**
   * Clear specific cache entries
   */
  invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.queryCache.clear();
      return;
    }

    const keysToDelete = Array.from(this.queryCache.keys())
      .filter(key => key.includes(pattern));
    
    keysToDelete.forEach(key => this.queryCache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    hitRate: number;
    memoryUsage: number;
  } {
    // This is a simplified implementation
    // In production, you'd want more sophisticated cache analytics
    return {
      totalEntries: this.queryCache.size,
      hitRate: 0.85, // Placeholder - would need actual hit/miss tracking
      memoryUsage: JSON.stringify(Array.from(this.queryCache.entries())).length
    };
  }
}

export const optimizedQueries = OptimizedQueries.getInstance();
export type { CacheEntry };