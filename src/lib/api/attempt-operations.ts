import { supabaseServer } from "@/lib/supabase/server";
import { dbPool } from "./db-pool";
import { queryOptimizer } from "./query-optimizer";

export interface AttemptState {
  attempt_id: string;
  exam_id: string;
  student_id: string;
  answers: Record<string, any>;
  auto_save_data: Record<string, any>;
  version: number;
  completion_status: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AttemptInfo {
  attempt_id: string;
  exam_id: string;
  student_id: string;
  student_code?: string;
  student_name?: string;
  exam_title?: string;
  submitted_at?: string;
  exam: {
    title?: string;
    description?: string;
    duration_minutes?: number;
    start_time?: string;
    end_time?: string;
  };
}

export interface AttemptSubmissionResult {
  total_questions: number;
  correct_count: number;
  score_percentage: number;
}

export interface BatchOperation {
  operation: 'save' | 'activity' | 'state';
  attempt_id: string;
  data: any;
}

/**
 * Optimized database operations for attempt management
 */
export class AttemptOperations {
  private supabase = supabaseServer();

  /**
   * Get attempt state with optimized query and caching
   */
  async getAttemptState(attemptId: string): Promise<AttemptState | null> {
    return dbPool.executeWithCircuitBreaker(
      `get_attempt_state_${attemptId}`,
      async () => {
        return dbPool.executeQuery(
          `attempt_state:${attemptId}`,
          async () => {
            const { data, error } = await this.supabase.rpc("get_attempt_state", {
              p_attempt_id: attemptId,
            });

            if (error) {
              throw new Error(`Failed to get attempt state: ${error.message}`);
            }

            return data;
          },
          30000 // 30 second cache for attempt state
        );
      }
    );
  }

  /**
   * Get attempt info with optimized joins
   */
  async getAttemptInfo(attemptId: string): Promise<AttemptInfo | null> {
    const { data, error } = await this.supabase
      .from("exam_attempts")
      .select(`
        exam_id,
        student_id,
        submitted_at,
        student_name,
        exams!inner(
          id,
          title,
          description,
          duration_minutes,
          start_time,
          end_time
        ),
        students(code, student_name)
      `)
      .eq("id", attemptId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to get attempt info: ${error.message}`);
    }

    const examData = (data as any).exams;

    return {
      attempt_id: attemptId,
      exam_id: (data as any).exam_id || null,
      student_id: (data as any).student_id || null,
      student_code: (data as any).students?.code || null,
      student_name: (data as any).students?.student_name || (data as any).student_name || null,
      exam_title: examData?.title,
      submitted_at: data.submitted_at,
      exam: {
        title: examData?.title,
        description: examData?.description,
        duration_minutes: examData?.duration_minutes,
        start_time: examData?.start_time,
        end_time: examData?.end_time,
      }
    };
  }

  /**
   * Save attempt with version control and conflict resolution
   */
  async saveAttempt(
    attemptId: string,
    answers: Record<string, any>,
    autoSaveData: Record<string, any>,
    expectedVersion: number = 1
  ): Promise<{ new_version: number; conflict?: boolean; latest?: AttemptState }> {
    return dbPool.executeWithRetry(async () => {
      const { data, error } = await this.supabase.rpc("save_attempt", {
        p_attempt_id: attemptId,
        p_answers: answers,
        p_auto_save_data: autoSaveData,
        p_expected_version: expectedVersion,
      });

      if (error) {
        if (error.message && error.message.includes("version_mismatch")) {
          const latest = await this.getAttemptState(attemptId);
          return {
            new_version: expectedVersion,
            conflict: true,
            latest: latest || undefined
          };
        }
        throw new Error(`Failed to save attempt: ${error.message}`);
      }

      // Invalidate cache after successful save
      dbPool.invalidateCache(`attempt_state:${attemptId}`);
      dbPool.invalidateCache(`attempt_info:${attemptId}`);

      const row = Array.isArray(data) ? data[0] : data;
      return { new_version: row?.new_version ?? expectedVersion + 1 };
    });
  }

  /**
   * Submit attempt and update tracking
   */
  async submitAttempt(attemptId: string): Promise<AttemptSubmissionResult> {
    const { data, error } = await this.supabase.rpc("submit_attempt", {
      p_attempt_id: attemptId,
    });

    if (error) {
      throw new Error(`Failed to submit attempt: ${error.message}`);
    }

    // Update student_exam_attempts status in parallel
    this.updateStudentExamAttemptStatus(attemptId).catch(err => {
      console.error("Failed to update student_exam_attempts status:", err);
    });

    const row = Array.isArray(data) ? data[0] : data;
    return {
      total_questions: row?.total_questions ?? 0,
      correct_count: row?.correct_count ?? 0,
      score_percentage: row?.score_percentage ?? 0,
    };
  }

  /**
   * Log attempt activity with batch processing
   */
  async logAttemptActivity(attemptId: string, events: any[]): Promise<number> {
    if (!Array.isArray(events) || events.length === 0) {
      return 0;
    }

    const { data, error } = await this.supabase.rpc("log_attempt_activity", {
      p_attempt_id: attemptId,
      p_events: events,
    });

    if (error) {
      throw new Error(`Failed to log attempt activity: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return row?.inserted_count ?? 0;
  }

  /**
   * Validate attempt exists and is accessible
   */
  async validateAttempt(attemptId: string): Promise<{
    valid: boolean;
    attempt?: any;
    error?: string;
    status?: number;
  }> {
    const { data, error } = await this.supabase
      .from("exam_attempts")
      .select("id, completion_status, exam_id, student_id")
      .eq("id", attemptId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { valid: false, error: "Attempt not found", status: 404 };
      }
      return { valid: false, error: error.message, status: 400 };
    }

    return { valid: true, attempt: data };
  }

  /**
   * Batch save multiple attempts using optimized RPC
   */
  async batchSaveAttempts(operations: Array<{
    attempt_id: string;
    answers: Record<string, any>;
    auto_save_data: Record<string, any>;
    expected_version: number;
  }>): Promise<Array<{
    attempt_id: string;
    success: boolean;
    new_version?: number;
    error_message?: string;
  }>> {
    if (operations.length === 0) return [];

    const { data, error } = await this.supabase.rpc("batch_save_attempts", {
      p_operations: operations
    });

    if (error) {
      throw new Error(`Failed to batch save attempts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get multiple attempt states efficiently using optimized RPC
   */
  async getMultipleAttemptStatesOptimized(attemptIds: string[]): Promise<Record<string, any>> {
    if (attemptIds.length === 0) return {};

    const { data, error } = await this.supabase.rpc("get_multiple_attempt_states", {
      p_attempt_ids: attemptIds
    });

    if (error) {
      throw new Error(`Failed to get multiple attempt states: ${error.message}`);
    }

    const result: Record<string, any> = {};
    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.attempt_id && item.state) {
          result[item.attempt_id] = item.state;
        }
      });
    }

    return result;
  }

  /**
   * Get multiple attempt info efficiently using optimized RPC
   */
  async getMultipleAttemptInfo(attemptIds: string[]): Promise<Record<string, AttemptInfo>> {
    if (attemptIds.length === 0) return {};

    const { data, error } = await this.supabase.rpc("get_multiple_attempt_info", {
      p_attempt_ids: attemptIds
    });

    if (error) {
      throw new Error(`Failed to get multiple attempt info: ${error.message}`);
    }

    const result: Record<string, AttemptInfo> = {};
    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.attempt_id) {
          result[item.attempt_id] = {
            attempt_id: item.attempt_id,
            exam_id: item.exam_id,
            student_id: item.student_id,
            student_code: item.student_code,
            student_name: item.student_name,
            exam_title: item.exam_title,
            submitted_at: item.submitted_at,
            exam: item.exam_info || {}
          };
        }
      });
    }

    return result;
  }

  /**
   * Batch log activity for multiple attempts
   */
  async batchLogAttemptActivity(batch: Array<{
    attempt_id: string;
    events: any[];
  }>): Promise<Array<{
    attempt_id: string;
    inserted_count: number;
    success: boolean;
    error_message?: string;
  }>> {
    if (batch.length === 0) return [];

    const { data, error } = await this.supabase.rpc("batch_log_attempt_activity", {
      p_batch: batch
    });

    if (error) {
      throw new Error(`Failed to batch log attempt activity: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Validate multiple attempts efficiently
   */
  async validateMultipleAttempts(attemptIds: string[]): Promise<Record<string, {
    valid: boolean;
    completion_status?: string;
    exam_id?: string;
    student_id?: string;
    error_message?: string;
  }>> {
    if (attemptIds.length === 0) return {};

    const { data, error } = await this.supabase.rpc("validate_multiple_attempts", {
      p_attempt_ids: attemptIds
    });

    if (error) {
      throw new Error(`Failed to validate multiple attempts: ${error.message}`);
    }

    const result: Record<string, any> = {};
    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.attempt_id) {
          result[item.attempt_id] = {
            valid: item.valid,
            completion_status: item.completion_status,
            exam_id: item.exam_id,
            student_id: item.student_id,
            error_message: item.error_message
          };
        }
      });
    }

    return result;
  }

  /**
   * Batch process multiple operations for efficiency (legacy support)
   */
  async batchOperations(operations: BatchOperation[]): Promise<any[]> {
    const results = await Promise.allSettled(
      operations.map(async (op) => {
        switch (op.operation) {
          case 'save':
            return this.saveAttempt(
              op.attempt_id,
              op.data.answers || {},
              op.data.auto_save_data || {},
              op.data.expected_version || 1
            );
          case 'activity':
            return this.logAttemptActivity(op.attempt_id, op.data.events || []);
          case 'state':
            return this.getAttemptState(op.attempt_id);
          default:
            throw new Error(`Unknown operation: ${op.operation}`);
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { success: true, data: result.value, operation: operations[index] };
      } else {
        return { success: false, error: result.reason.message, operation: operations[index] };
      }
    });
  }

  /**
   * Get multiple attempt states efficiently using query optimizer
   */
  async getMultipleAttemptStates(attemptIds: string[]): Promise<Record<string, AttemptState | null>> {
    if (attemptIds.length === 0) return {};

    // Use query optimizer for batch processing
    const operations = attemptIds.map((id, index) => ({
      type: 'state' as const,
      attemptId: id
    }));

    const results = await queryOptimizer.optimizeAttemptQueries<AttemptState>(operations);
    
    // Convert indexed results back to attemptId-keyed results
    const finalResults: Record<string, AttemptState | null> = {};
    attemptIds.forEach((id, index) => {
      finalResults[id] = results[`${index}`] || null;
    });

    return finalResults;
  }

  /**
   * Update student exam attempt status (non-blocking)
   */
  private async updateStudentExamAttemptStatus(attemptId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("student_exam_attempts")
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString() 
        })
        .eq("attempt_id", attemptId);

      if (error) {
        console.error("Failed to update student_exam_attempts status:", error.message);
      } else {
        console.log("✅ Updated student_exam_attempts status for attempt:", attemptId);
      }
    } catch (e) {
      console.error("Exception updating student_exam_attempts status:", e);
    }
  }

  /**
   * Check if attempt is submitted to prevent further modifications
   */
  async isAttemptSubmitted(attemptId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("exam_attempts")
      .select("completion_status")
      .eq("id", attemptId)
      .single();

    if (error || !data) return false;
    return data.completion_status === "submitted";
  }

  /**
   * Get attempt statistics using optimized RPC
   */
  async getAttemptStats(examId?: string): Promise<{
    total_attempts: number;
    active_attempts: number;
    submitted_attempts: number;
    avg_completion_time_minutes?: number;
  }> {
    const { data, error } = await this.supabase.rpc("get_attempt_statistics", {
      p_exam_id: examId || null
    });

    if (error) {
      throw new Error(`Failed to get attempt stats: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      total_attempts: Number(row?.total_attempts || 0),
      active_attempts: Number(row?.active_attempts || 0),
      submitted_attempts: Number(row?.submitted_attempts || 0),
      avg_completion_time_minutes: row?.avg_completion_time_minutes ? Number(row.avg_completion_time_minutes) : undefined
    };
  }

  /**
   * Get active attempts for real-time monitoring
   */
  async getActiveAttempts(examId?: string): Promise<Array<{
    attempt_id: string;
    exam_id: string;
    student_name?: string;
    started_at: string;
    last_activity: string;
    progress_data?: any;
    ip_address?: string;
  }>> {
    const { data, error } = await this.supabase.rpc("get_active_attempts", {
      p_exam_id: examId || null
    });

    if (error) {
      throw new Error(`Failed to get active attempts: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      attempt_id: item.attempt_id,
      exam_id: item.exam_id,
      student_name: item.student_name,
      started_at: item.started_at,
      last_activity: item.last_activity,
      progress_data: item.progress_data,
      ip_address: item.ip_address
    }));
  }

  /**
   * Validate attempt upload with optimized RPC
   */
  async validateAttemptUpload(attemptId: string): Promise<{
    valid: boolean;
    completion_status?: string;
    error_message?: string;
  }> {
    const { data, error } = await this.supabase.rpc("validate_attempt_upload", {
      p_attempt_id: attemptId
    });

    if (error) {
      throw new Error(`Failed to validate attempt upload: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      valid: row?.valid || false,
      completion_status: row?.completion_status,
      error_message: row?.error_message
    };
  }

  /**
   * Batch submit attempts (for cleanup operations)
   */
  async batchSubmitAttempts(attemptIds: string[]): Promise<Array<{
    attempt_id: string;
    success: boolean;
    total_questions?: number;
    correct_count?: number;
    score_percentage?: number;
    error_message?: string;
  }>> {
    if (attemptIds.length === 0) return [];

    const { data, error } = await this.supabase.rpc("batch_submit_attempts", {
      p_attempt_ids: attemptIds
    });

    if (error) {
      throw new Error(`Failed to batch submit attempts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get optimization metrics and performance data
   */
  getOptimizationMetrics(): {
    cacheStats: any;
    queryOptimization: any;
    connectionPool: any;
  } {
    return {
      cacheStats: dbPool.getCacheStats(),
      queryOptimization: queryOptimizer.getOptimizationMetrics(),
      connectionPool: {
        activeConnections: 1, // Would track actual connections in real implementation
        queryCount: 0, // Would track query count
        avgResponseTime: 0 // Would track average response time
      }
    };
  }

  /**
   * Preload frequently accessed attempt data for performance
   */
  async preloadAttemptData(examIds: string[]): Promise<void> {
    await queryOptimizer.preloadFrequentData(examIds);
  }

  /**
   * Clear optimization caches (useful for testing or manual cache invalidation)
   */
  clearOptimizationCache(): void {
    dbPool.clearCache();
    queryOptimizer.clearOptimizationCache();
  }

  /**
   * Analyze and optimize database queries
   */
  async analyzeQueryPerformance(): Promise<{
    recommendations: string[];
    slowQueries: Array<{ query: string; avgTime: number; count: number }>;
  }> {
    return queryOptimizer.analyzeQueryPatterns();
  }
}

// Export singleton instance
export const attemptOperations = new AttemptOperations();