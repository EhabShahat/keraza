/**
 * Consolidated RPC Client
 * Provides optimized access to consolidated database functions
 * Reduces round trips by batching operations and using unified handlers
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

export interface ConsolidatedRPCClient {
  // Attempt management operations
  attemptManager(operation: string, params: Record<string, any>): Promise<any>;
  
  // Admin operations
  adminManager(operation: string, params: Record<string, any>): Promise<any>;
  
  // Student operations
  studentManager(operation: string, params: Record<string, any>): Promise<any>;
  
  // Monitoring and analytics
  monitoringManager(operation: string, params: Record<string, any>): Promise<any>;
  
  // Batch operations
  batchExecute(operations: BatchOperation[]): Promise<BatchResult[]>;
}

export interface BatchOperation {
  type: 'attempt' | 'admin' | 'student' | 'monitoring';
  operation: string;
  params: Record<string, any>;
  id?: string; // For tracking results
}

export interface BatchResult {
  id?: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class OptimizedRPCClient implements ConsolidatedRPCClient {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Consolidated attempt management operations
   * Handles start, save, submit, state, and batch operations
   */
  async attemptManager(operation: string, params: Record<string, any>): Promise<any> {
    const { data, error } = await this.supabase.rpc('attempt_manager', {
      p_operation: operation,
      p_exam_id: params.examId || null,
      p_attempt_id: params.attemptId || null,
      p_code: params.code || null,
      p_student_name: params.studentName || null,
      p_ip: params.ip || null,
      p_answers: params.answers || null,
      p_auto_save_data: params.autoSaveData || null,
      p_expected_version: params.expectedVersion || null,
      p_device_info: params.deviceInfo || null
    });

    if (error) {
      throw new Error(`Attempt operation '${operation}' failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Consolidated admin operations
   * Handles user management, regrading, and administrative tasks
   */
  async adminManager(operation: string, params: Record<string, any>): Promise<any> {
    const { data, error } = await this.supabase.rpc('admin_manager', {
      p_operation: operation,
      p_user_id: params.userId || null,
      p_email: params.email || null,
      p_username: params.username || null,
      p_password: params.password || null,
      p_exam_id: params.examId || null,
      p_attempt_id: params.attemptId || null,
      p_student_id: params.studentId || null,
      p_params: params.additionalParams || null
    });

    if (error) {
      throw new Error(`Admin operation '${operation}' failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Consolidated student operations
   * Handles student lookup, validation, and bulk operations
   */
  async studentManager(operation: string, params: Record<string, any>): Promise<any> {
    const { data, error } = await this.supabase.rpc('student_manager', {
      p_operation: operation,
      p_code: params.code || null,
      p_student_id: params.studentId || null,
      p_exam_id: params.examId || null,
      p_student_data: params.studentData || null,
      p_bulk_data: params.bulkData || null
    });

    if (error) {
      throw new Error(`Student operation '${operation}' failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Consolidated monitoring and analytics operations
   * Handles performance metrics, active attempts, and system statistics
   */
  async monitoringManager(operation: string, params: Record<string, any> = {}): Promise<any> {
    const { data, error } = await this.supabase.rpc('monitoring_manager', {
      p_operation: operation,
      p_exam_id: params.examId || null,
      p_time_window: params.timeWindow || '1 hour',
      p_params: params.additionalParams || null
    });

    if (error) {
      throw new Error(`Monitoring operation '${operation}' failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Execute multiple operations in a single batch
   * Reduces round trips for bulk operations
   */
  async batchExecute(operations: BatchOperation[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    
    // Group operations by type for optimal batching
    const groupedOps = operations.reduce((acc, op) => {
      if (!acc[op.type]) acc[op.type] = [];
      acc[op.type].push(op);
      return acc;
    }, {} as Record<string, BatchOperation[]>);

    // Execute each group
    for (const [type, ops] of Object.entries(groupedOps)) {
      for (const op of ops) {
        try {
          let result: any;
          
          switch (type) {
            case 'attempt':
              result = await this.attemptManager(op.operation, op.params);
              break;
            case 'admin':
              result = await this.adminManager(op.operation, op.params);
              break;
            case 'student':
              result = await this.studentManager(op.operation, op.params);
              break;
            case 'monitoring':
              result = await this.monitoringManager(op.operation, op.params);
              break;
            default:
              throw new Error(`Unknown operation type: ${type}`);
          }

          results.push({
            id: op.id,
            success: true,
            data: result
          });
        } catch (error) {
          results.push({
            id: op.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return results;
  }
}

/**
 * Optimized RPC operations for specific use cases
 */
export class OptimizedRPCOperations {
  constructor(private client: OptimizedRPCClient) {}

  // Attempt operations
  async startAttempt(examId: string, code?: string, studentName?: string, ip?: string, deviceInfo?: any) {
    return this.client.attemptManager('start', {
      examId,
      code,
      studentName,
      ip,
      deviceInfo
    });
  }

  async saveAttempt(attemptId: string, answers: any, autoSaveData: any, expectedVersion: number) {
    return this.client.attemptManager('save', {
      attemptId,
      answers,
      autoSaveData,
      expectedVersion
    });
  }

  async saveAndGetState(attemptId: string, answers: any, autoSaveData: any, expectedVersion: number) {
    return this.client.attemptManager('save_and_state', {
      attemptId,
      answers,
      autoSaveData,
      expectedVersion
    });
  }

  async submitAttempt(attemptId: string) {
    return this.client.attemptManager('submit', {
      attemptId
    });
  }

  async getAttemptState(attemptId: string) {
    return this.client.attemptManager('state', {
      attemptId
    });
  }

  // Batch operations for performance
  async batchGetAttemptStates(attemptIds: string[]) {
    const { data, error } = await this.client.supabase.rpc('batch_get_attempt_states', {
      p_attempt_ids: attemptIds
    });

    if (error) {
      throw new Error(`Batch get attempt states failed: ${error.message}`);
    }

    return data;
  }

  async batchUpdateAttemptProgress(updates: Array<{
    attemptId: string;
    answers?: any;
    autoSaveData?: any;
    expectedVersion: number;
  }>) {
    const formattedUpdates = updates.map(update => ({
      attempt_id: update.attemptId,
      answers: update.answers,
      auto_save_data: update.autoSaveData,
      expected_version: update.expectedVersion
    }));

    const { data, error } = await this.client.supabase.rpc('batch_update_attempt_progress', {
      p_updates: formattedUpdates
    });

    if (error) {
      throw new Error(`Batch update attempt progress failed: ${error.message}`);
    }

    return data;
  }

  async batchCalculateResults(attemptIds: string[]) {
    const { data, error } = await this.client.supabase.rpc('batch_calculate_results', {
      p_attempt_ids: attemptIds
    });

    if (error) {
      throw new Error(`Batch calculate results failed: ${error.message}`);
    }

    return data;
  }

  // Admin operations
  async listAdmins() {
    return this.client.adminManager('list_admins', {});
  }

  async addAdmin(email: string) {
    return this.client.adminManager('add_admin', { email });
  }

  async removeAdmin(userId: string) {
    return this.client.adminManager('remove_admin', { userId });
  }

  async createUser(username: string, email: string, password: string, isAdmin = false) {
    return this.client.adminManager('create_user', {
      username,
      email,
      password,
      additionalParams: { is_admin: isAdmin }
    });
  }

  async regradeExam(examId: string) {
    return this.client.adminManager('regrade_exam', { examId });
  }

  async regradeAttempt(attemptId: string) {
    return this.client.adminManager('regrade_attempt', { attemptId });
  }

  async resetStudentAttempts(studentId: string, examId?: string) {
    return this.client.adminManager('reset_student_attempts', { studentId, examId });
  }

  async cleanupExpiredAttempts() {
    return this.client.adminManager('cleanup_expired', {});
  }

  async listAttempts(examId: string) {
    return this.client.adminManager('list_attempts', { examId });
  }

  // Student operations
  async getStudentByCode(code: string) {
    return this.client.studentManager('get_by_code', { code });
  }

  async getStudentWithAttempts(code: string) {
    return this.client.studentManager('get_with_attempts', { code });
  }

  async validateStudentCode(code: string, examId?: string) {
    return this.client.studentManager('validate_code', { code, examId });
  }

  async bulkInsertStudents(students: Array<{ code: string; student_name: string; mobile_number?: string }>) {
    return this.client.studentManager('bulk_insert', { bulkData: students });
  }

  // Monitoring operations
  async getActiveAttempts() {
    return this.client.monitoringManager('active_attempts');
  }

  async getExamAnalytics(examId: string) {
    return this.client.monitoringManager('exam_analytics', { examId });
  }

  async getSystemStats(timeWindow = '1 hour') {
    return this.client.monitoringManager('system_stats', { timeWindow });
  }

  async getPerformanceSummary(timeWindow = '1 hour') {
    return this.client.monitoringManager('performance_summary', { timeWindow });
  }
}

// Factory function to create optimized RPC client
export function createOptimizedRPCClient(supabase: SupabaseClient<Database>) {
  const client = new OptimizedRPCClient(supabase);
  const operations = new OptimizedRPCOperations(client);
  
  return {
    client,
    operations
  };
}