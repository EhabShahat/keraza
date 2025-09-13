/**
 * Database Integration Helpers
 * Utilities to integrate optimized queries into existing API routes
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { optimizedQueries } from './optimized-queries';
import { queryOptimizer } from './query-optimizer';

/**
 * Enhanced Supabase client with optimization features
 */
export function createOptimizedSupabaseClient(serviceRoleKey?: string): SupabaseClient {
  return queryOptimizer.getOptimizedClient(serviceRoleKey);
}

/**
 * Optimized exam operations
 */
export const examOperations = {
  /**
   * Get published exams with caching
   */
  async getPublishedExams(client?: SupabaseClient) {
    return optimizedQueries.getPublishedExams(client);
  },

  /**
   * Get exam by ID with caching
   */
  async getExamById(examId: string, client?: SupabaseClient) {
    return optimizedQueries.getExamById(examId, client);
  },

  /**
   * Get exam with questions (optimized join)
   */
  async getExamWithQuestions(examId: string, client?: SupabaseClient) {
    return optimizedQueries.getExamWithQuestions(examId, client);
  },

  /**
   * Get exam attempts with pagination and filtering
   */
  async getExamAttempts(examId: string, options: {
    limit?: number;
    offset?: number;
    status?: string;
    client?: SupabaseClient;
  } = {}) {
    const { limit = 100, client } = options;
    return optimizedQueries.getExamAttempts(examId, limit, client);
  },

  /**
   * Batch get exam summaries using consolidated RPC
   */
  async batchGetExamSummaries(examIds: string[], client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('batch_get_exam_summaries', { 
      p_exam_ids: examIds 
    });

    if (error) {
      throw new Error(`Failed to get exam summaries: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Get exam with questions using consolidated RPC
   */
  async getExamWithQuestionsConsolidated(examId: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('exam_manager', {
      p_operation: 'get_with_questions',
      p_exam_id: examId
    });

    if (error) {
      throw new Error(`Failed to get exam with questions: ${error.message}`);
    }

    return data;
  }
};

/**
 * Optimized student operations
 */
export const studentOperations = {
  /**
   * Get student by code with caching
   */
  async getStudentByCode(code: string, client?: SupabaseClient) {
    return optimizedQueries.getStudentByCode(code, client);
  },

  /**
   * Get student with attempt history using consolidated RPC
   */
  async getStudentWithAttempts(code: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('student_manager', {
      p_operation: 'get_with_attempts',
      p_code: code
    });

    if (error) {
      throw new Error(`Failed to get student with attempts: ${error.message}`);
    }

    return data;
  },

  /**
   * Validate student code using consolidated RPC
   */
  async validateStudentCode(code: string, examId?: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('student_manager', {
      p_operation: 'validate_code',
      p_code: code,
      p_exam_id: examId || null
    });

    if (error) {
      throw new Error(`Failed to validate student code: ${error.message}`);
    }

    return data;
  },

  /**
   * Bulk insert students using consolidated RPC
   */
  async bulkInsertStudentsConsolidated(students: Array<{
    code: string;
    student_name: string;
    mobile_number?: string;
  }>, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('student_manager', {
      p_operation: 'bulk_insert',
      p_bulk_data: students
    });

    if (error) {
      throw new Error(`Failed to bulk insert students: ${error.message}`);
    }

    return data;
  },

  /**
   * Batch insert students with optimization
   */
  async batchInsertStudents(students: any[], client?: SupabaseClient) {
    return optimizedQueries.batchInsertStudents(students, client);
  },

  /**
   * Get student attempts with filtering
   */
  async getStudentAttempts(studentId: string, examId?: string, client?: SupabaseClient) {
    return optimizedQueries.getStudentAttempts(studentId, examId, client);
  }
};

/**
 * Optimized attempt operations
 */
export const attemptOperations = {
  /**
   * Get attempt state using consolidated RPC
   */
  async getAttemptState(attemptId: string, useCache: boolean = false, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('attempt_manager', {
      p_operation: 'state',
      p_attempt_id: attemptId
    });

    if (error) {
      throw new Error(`Failed to get attempt state: ${error.message}`);
    }

    return data?.state || null;
  },

  /**
   * Start attempt using consolidated RPC
   */
  async startAttempt(
    examId: string,
    code?: string,
    studentName?: string,
    ip?: string,
    deviceInfo?: any,
    client?: SupabaseClient
  ) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('attempt_manager', {
      p_operation: 'start',
      p_exam_id: examId,
      p_code: code || null,
      p_student_name: studentName || null,
      p_ip: ip || null,
      p_device_info: deviceInfo || null
    });

    if (error) {
      throw new Error(`Failed to start attempt: ${error.message}`);
    }

    return data;
  },

  /**
   * Save attempt using consolidated RPC
   */
  async saveAttempt(
    attemptId: string,
    answers: any,
    autoSaveData: any,
    expectedVersion: number,
    client?: SupabaseClient
  ) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('attempt_manager', {
      p_operation: 'save',
      p_attempt_id: attemptId,
      p_answers: answers,
      p_auto_save_data: autoSaveData,
      p_expected_version: expectedVersion
    });

    if (error) {
      throw new Error(`Failed to save attempt: ${error.message}`);
    }

    return data;
  },

  /**
   * Save attempt and get state in one call using consolidated RPC
   */
  async saveAndGetState(
    attemptId: string,
    answers: any,
    autoSaveData: any,
    expectedVersion: number,
    client?: SupabaseClient
  ) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('attempt_manager', {
      p_operation: 'save_and_state',
      p_attempt_id: attemptId,
      p_answers: answers,
      p_auto_save_data: autoSaveData,
      p_expected_version: expectedVersion
    });

    if (error) {
      throw new Error(`Failed to save and get state: ${error.message}`);
    }

    return data;
  },

  /**
   * Submit attempt using consolidated RPC
   */
  async submitAttempt(attemptId: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('attempt_manager', {
      p_operation: 'submit',
      p_attempt_id: attemptId
    });

    if (error) {
      throw new Error(`Failed to submit attempt: ${error.message}`);
    }

    return data;
  },

  /**
   * Batch update attempt progress using optimized RPC
   */
  async batchUpdateProgress(updates: Array<{
    attemptId: string;
    answers?: any;
    autoSaveData?: any;
    expectedVersion: number;
  }>, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const formattedUpdates = updates.map(update => ({
      attempt_id: update.attemptId,
      answers: update.answers,
      auto_save_data: update.autoSaveData,
      expected_version: update.expectedVersion
    }));
    
    const { data, error } = await supabase.rpc('batch_update_attempt_progress', { 
      p_updates: formattedUpdates 
    });

    if (error) {
      throw new Error(`Failed to batch update progress: ${error.message}`);
    }

    return data;
  },

  /**
   * Get attempt with full details (optimized join)
   */
  async getAttemptWithDetails(attemptId: string, client?: SupabaseClient) {
    return optimizedQueries.getAttemptWithDetails(attemptId, client);
  },

  /**
   * Batch get attempt states for monitoring
   */
  async batchGetAttemptStates(attemptIds: string[], client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('batch_get_attempt_states', { 
      p_attempt_ids: attemptIds 
    });

    if (error) {
      throw new Error(`Failed to batch get attempt states: ${error.message}`);
    }

    return data || [];
  }
};

/**
 * Optimized settings operations
 */
export const settingsOperations = {
  /**
   * Get app settings with caching
   */
  async getAppSettings(client?: SupabaseClient) {
    return optimizedQueries.getAppSettings(client);
  },

  /**
   * Invalidate settings cache
   */
  invalidateSettingsCache() {
    optimizedQueries.invalidateCache('app_settings');
  }
};

/**
 * Optimized analytics operations
 */
export const analyticsOperations = {
  /**
   * Get exam analytics with caching
   */
  async getExamAnalytics(examId: string, client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    return optimizedQueries.callRPCWithCache(
      'get_exam_analytics',
      { p_exam_id: examId },
      5 * 60 * 1000, // 5 minutes cache
      supabase
    );
  },

  /**
   * Get active attempts summary using consolidated RPC
   */
  async getActiveAttemptsSummary(client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('monitoring_manager', {
      p_operation: 'active_attempts'
    });

    if (error) {
      throw new Error(`Failed to get active attempts summary: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Get system statistics using consolidated RPC
   */
  async getSystemStats(timeWindow = '1 hour', client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('monitoring_manager', {
      p_operation: 'system_stats',
      p_time_window: timeWindow
    });

    if (error) {
      throw new Error(`Failed to get system stats: ${error.message}`);
    }

    return data;
  },

  /**
   * Get performance summary using consolidated RPC
   */
  async getPerformanceSummary(timeWindow = '1 hour', client?: SupabaseClient) {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    const { data, error } = await supabase.rpc('monitoring_manager', {
      p_operation: 'performance_summary',
      p_time_window: timeWindow
    });

    if (error) {
      throw new Error(`Failed to get performance summary: ${error.message}`);
    }

    return data;
  }
};

/**
 * Cache management utilities
 */
export const cacheOperations = {
  /**
   * Invalidate cache for specific patterns
   */
  invalidateCache(pattern?: string) {
    optimizedQueries.invalidateCache(pattern);
  },

  /**
   * Invalidate exam-related caches
   */
  invalidateExamCache(examId?: string) {
    if (examId) {
      optimizedQueries.invalidateCache(`exam_${examId}`);
      optimizedQueries.invalidateCache(`exam_with_questions_${examId}`);
    } else {
      optimizedQueries.invalidateCache('published_exams');
    }
  },

  /**
   * Invalidate student-related caches
   */
  invalidateStudentCache(code?: string) {
    if (code) {
      optimizedQueries.invalidateCache(`student_${code}`);
    }
  },

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return optimizedQueries.getCacheStats();
  }
};

/**
 * Migration helper to gradually replace existing queries
 */
export function createMigrationWrapper<T extends any[], R>(
  legacyFn: (...args: T) => Promise<R>,
  optimizedFn: (...args: T) => Promise<R>,
  useOptimized: boolean = true
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    if (useOptimized) {
      try {
        return await optimizedFn(...args);
      } catch (error) {
        console.warn('Optimized query failed, falling back to legacy:', error);
        return await legacyFn(...args);
      }
    }
    return await legacyFn(...args);
  };
}