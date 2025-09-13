import { dbPool } from "./db-pool";

/**
 * Query optimization utilities for attempt management
 */
export class QueryOptimizer {
  private static instance: QueryOptimizer;

  private constructor() {}

  static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  /**
   * Optimize attempt queries by batching similar operations
   */
  async optimizeAttemptQueries<T>(
    operations: Array<{
      type: 'state' | 'info' | 'validate' | 'stats';
      attemptId?: string;
      examId?: string;
      params?: any;
    }>
  ): Promise<Record<string, T>> {
    // Group operations by type for batch processing
    const grouped = operations.reduce((acc, op, index) => {
      const key = op.type;
      if (!acc[key]) acc[key] = [];
      acc[key].push({ ...op, index });
      return acc;
    }, {} as Record<string, any[]>);

    const results: Record<string, T> = {};

    // Process each group in parallel
    const promises = Object.entries(grouped).map(async ([type, ops]) => {
      switch (type) {
        case 'state':
          const stateIds = ops.map(op => op.attemptId).filter(Boolean);
          if (stateIds.length > 0) {
            const states = await this.batchGetAttemptStates(stateIds);
            ops.forEach(op => {
              if (op.attemptId) {
                results[`${op.index}`] = states[op.attemptId] as T;
              }
            });
          }
          break;

        case 'info':
          const infoIds = ops.map(op => op.attemptId).filter(Boolean);
          if (infoIds.length > 0) {
            const info = await this.batchGetAttemptInfo(infoIds);
            ops.forEach(op => {
              if (op.attemptId) {
                results[`${op.index}`] = info[op.attemptId] as T;
              }
            });
          }
          break;

        case 'validate':
          const validateIds = ops.map(op => op.attemptId).filter(Boolean);
          if (validateIds.length > 0) {
            const validations = await this.batchValidateAttempts(validateIds);
            ops.forEach(op => {
              if (op.attemptId) {
                results[`${op.index}`] = validations[op.attemptId] as T;
              }
            });
          }
          break;

        case 'stats':
          // Stats operations are typically per-exam, so process individually
          const statsPromises = ops.map(async (op) => {
            const stats = await this.getOptimizedStats(op.examId);
            results[`${op.index}`] = stats as T;
          });
          await Promise.all(statsPromises);
          break;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Batch get attempt states with intelligent caching
   */
  private async batchGetAttemptStates(attemptIds: string[]): Promise<Record<string, any>> {
    const cacheKey = `batch_states:${attemptIds.sort().join(',')}`;
    
    return dbPool.executeQuery(
      cacheKey,
      async () => {
        const client = dbPool.getConnection();
        const { data, error } = await client.rpc("get_multiple_attempt_states", {
          p_attempt_ids: attemptIds
        });

        if (error) {
          throw new Error(`Failed to batch get attempt states: ${error.message}`);
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
      },
      60000 // 1 minute cache for batch states
    );
  }

  /**
   * Batch get attempt info with optimized joins
   */
  private async batchGetAttemptInfo(attemptIds: string[]): Promise<Record<string, any>> {
    const cacheKey = `batch_info:${attemptIds.sort().join(',')}`;
    
    return dbPool.executeQuery(
      cacheKey,
      async () => {
        const client = dbPool.getConnection();
        const { data, error } = await client.rpc("get_multiple_attempt_info", {
          p_attempt_ids: attemptIds
        });

        if (error) {
          throw new Error(`Failed to batch get attempt info: ${error.message}`);
        }

        const result: Record<string, any> = {};
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
      },
      300000 // 5 minute cache for attempt info
    );
  }

  /**
   * Batch validate attempts with optimized queries
   */
  private async batchValidateAttempts(attemptIds: string[]): Promise<Record<string, any>> {
    const cacheKey = `batch_validate:${attemptIds.sort().join(',')}`;
    
    return dbPool.executeQuery(
      cacheKey,
      async () => {
        const client = dbPool.getConnection();
        const { data, error } = await client.rpc("validate_multiple_attempts", {
          p_attempt_ids: attemptIds
        });

        if (error) {
          throw new Error(`Failed to batch validate attempts: ${error.message}`);
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
      },
      30000 // 30 second cache for validations
    );
  }

  /**
   * Get optimized stats with caching
   */
  private async getOptimizedStats(examId?: string): Promise<any> {
    const cacheKey = `stats:${examId || 'global'}`;
    
    return dbPool.executeQuery(
      cacheKey,
      async () => {
        const client = dbPool.getConnection();
        const { data, error } = await client.rpc("get_attempt_statistics", {
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
      },
      120000 // 2 minute cache for stats
    );
  }

  /**
   * Optimize database indexes based on query patterns
   */
  async analyzeQueryPatterns(): Promise<{
    recommendations: string[];
    slowQueries: Array<{ query: string; avgTime: number; count: number }>;
  }> {
    // This would analyze actual query performance in a real implementation
    // For now, return static recommendations based on our optimization work
    return {
      recommendations: [
        "Consider adding composite index on (exam_id, completion_status, created_at) for attempt queries",
        "Add index on (attempt_id, event_time) for activity events",
        "Consider partitioning exam_attempts table by exam_id for large datasets",
        "Add covering index on frequently accessed attempt columns"
      ],
      slowQueries: []
    };
  }

  /**
   * Preload frequently accessed data
   */
  async preloadFrequentData(examIds: string[]): Promise<void> {
    const promises = examIds.map(async (examId) => {
      // Preload exam stats
      await this.getOptimizedStats(examId);
      
      // Preload active attempts for this exam
      const client = dbPool.getConnection();
      await dbPool.executeQuery(
        `active_attempts:${examId}`,
        async () => {
          const { data } = await client.rpc("get_active_attempts", {
            p_exam_id: examId
          });
          return data || [];
        },
        60000 // 1 minute cache
      );
    });

    await Promise.all(promises);
  }

  /**
   * Clean up optimization caches
   */
  clearOptimizationCache(): void {
    dbPool.clearCache();
  }

  /**
   * Get optimization metrics
   */
  getOptimizationMetrics(): {
    cacheStats: any;
    circuitBreakerStats: any;
  } {
    return {
      cacheStats: dbPool.getCacheStats(),
      circuitBreakerStats: {} // Would track circuit breaker metrics in real implementation
    };
  }
}

// Export singleton instance
export const queryOptimizer = QueryOptimizer.getInstance();