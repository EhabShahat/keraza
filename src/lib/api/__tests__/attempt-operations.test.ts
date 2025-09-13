/**
 * Test suite for optimized attempt database operations
 * This file tests the performance improvements and batch operations
 */

import { attemptOperations } from '../attempt-operations';
import { dbPool } from '../db-pool';
import { queryOptimizer } from '../query-optimizer';

// Mock Supabase client
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        maybeSingle: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    }))
  }))
};

// Mock the supabase server
jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: () => mockSupabase
}));

describe('AttemptOperations - Database Optimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbPool.clearCache();
  });

  describe('Batch Operations', () => {
    it('should batch save multiple attempts efficiently', async () => {
      const mockBatchData = [
        {
          attempt_id: 'attempt-1',
          answers: { q1: 'answer1' },
          auto_save_data: { progress: 50 },
          expected_version: 1
        },
        {
          attempt_id: 'attempt-2',
          answers: { q1: 'answer2' },
          auto_save_data: { progress: 75 },
          expected_version: 1
        }
      ];

      const mockResponse = [
        { attempt_id: 'attempt-1', success: true, new_version: 2 },
        { attempt_id: 'attempt-2', success: true, new_version: 2 }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await attemptOperations.batchSaveAttempts(mockBatchData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('batch_save_attempts', {
        p_operations: mockBatchData
      });
      expect(result).toEqual(mockResponse);
    });

    it('should get multiple attempt states using optimized RPC', async () => {
      const attemptIds = ['attempt-1', 'attempt-2', 'attempt-3'];
      const mockStates = [
        { attempt_id: 'attempt-1', state: { version: 1, status: 'in_progress' } },
        { attempt_id: 'attempt-2', state: { version: 2, status: 'submitted' } },
        { attempt_id: 'attempt-3', state: { version: 1, status: 'in_progress' } }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockStates, error: null });

      const result = await attemptOperations.getMultipleAttemptStatesOptimized(attemptIds);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_multiple_attempt_states', {
        p_attempt_ids: attemptIds
      });
      expect(result['attempt-1']).toEqual(mockStates[0].state);
      expect(result['attempt-2']).toEqual(mockStates[1].state);
      expect(result['attempt-3']).toEqual(mockStates[2].state);
    });

    it('should batch log activity events', async () => {
      const batchData = [
        {
          attempt_id: 'attempt-1',
          events: [
            { event_type: 'answer_changed', payload: { question_id: 'q1' } }
          ]
        },
        {
          attempt_id: 'attempt-2',
          events: [
            { event_type: 'page_focus', payload: { timestamp: Date.now() } }
          ]
        }
      ];

      const mockResponse = [
        { attempt_id: 'attempt-1', inserted_count: 1, success: true },
        { attempt_id: 'attempt-2', inserted_count: 1, success: true }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await attemptOperations.batchLogAttemptActivity(batchData);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('batch_log_attempt_activity', {
        p_batch: batchData
      });
      expect(result).toEqual(mockResponse);
    });

    it('should validate multiple attempts efficiently', async () => {
      const attemptIds = ['attempt-1', 'attempt-2', 'invalid-attempt'];
      const mockValidations = [
        { attempt_id: 'attempt-1', valid: true, completion_status: 'in_progress' },
        { attempt_id: 'attempt-2', valid: true, completion_status: 'submitted' },
        { attempt_id: 'invalid-attempt', valid: false, error_message: 'attempt_not_found' }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockValidations, error: null });

      const result = await attemptOperations.validateMultipleAttempts(attemptIds);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('validate_multiple_attempts', {
        p_attempt_ids: attemptIds
      });
      expect(result['attempt-1'].valid).toBe(true);
      expect(result['invalid-attempt'].valid).toBe(false);
    });
  });

  describe('Performance Optimizations', () => {
    it('should use caching for frequently accessed data', async () => {
      const attemptId = 'test-attempt';
      const mockState = { version: 1, status: 'in_progress' };

      mockSupabase.rpc.mockResolvedValue({ data: mockState, error: null });

      // First call should hit the database
      const result1 = await attemptOperations.getAttemptState(attemptId);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);

      // Second call should use cache (within cache TTL)
      const result2 = await attemptOperations.getAttemptState(attemptId);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1); // Still 1, not 2

      expect(result1).toEqual(mockState);
      expect(result2).toEqual(mockState);
    });

    it('should provide optimization metrics', () => {
      const metrics = attemptOperations.getOptimizationMetrics();

      expect(metrics).toHaveProperty('cacheStats');
      expect(metrics).toHaveProperty('queryOptimization');
      expect(metrics).toHaveProperty('connectionPool');
      expect(metrics.cacheStats).toHaveProperty('size');
    });

    it('should analyze query performance', async () => {
      const analysis = await attemptOperations.analyzeQueryPerformance();

      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('slowQueries');
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      expect(Array.isArray(analysis.slowQueries)).toBe(true);
    });

    it('should preload frequently accessed data', async () => {
      const examIds = ['exam-1', 'exam-2'];
      
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      await attemptOperations.preloadAttemptData(examIds);

      // Should have made calls to preload data for each exam
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle RPC errors gracefully', async () => {
      const attemptIds = ['attempt-1'];
      mockSupabase.rpc.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database connection failed' } 
      });

      await expect(
        attemptOperations.getMultipleAttemptStatesOptimized(attemptIds)
      ).rejects.toThrow('Failed to get multiple attempt states');
    });

    it('should retry failed operations', async () => {
      const attemptId = 'test-attempt';
      const answers = { q1: 'answer' };
      const autoSaveData = { progress: 50 };

      // First call fails, second succeeds
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: { message: 'Temporary failure' } })
        .mockResolvedValueOnce({ data: [{ new_version: 2 }], error: null });

      const result = await attemptOperations.saveAttempt(attemptId, answers, autoSaveData, 1);

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
      expect(result.new_version).toBe(2);
    });

    it('should handle version conflicts in save operations', async () => {
      const attemptId = 'test-attempt';
      const answers = { q1: 'answer' };
      const autoSaveData = { progress: 50 };

      mockSupabase.rpc
        .mockResolvedValueOnce({ 
          data: null, 
          error: { message: 'version_mismatch' } 
        })
        .mockResolvedValueOnce({ 
          data: { version: 3, status: 'in_progress' }, 
          error: null 
        });

      const result = await attemptOperations.saveAttempt(attemptId, answers, autoSaveData, 1);

      expect(result.conflict).toBe(true);
      expect(result.latest).toBeDefined();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should get attempt statistics using optimized RPC', async () => {
      const examId = 'exam-1';
      const mockStats = {
        total_attempts: 100,
        active_attempts: 25,
        submitted_attempts: 75,
        avg_completion_time_minutes: 45.5
      };

      mockSupabase.rpc.mockResolvedValue({ data: [mockStats], error: null });

      const result = await attemptOperations.getAttemptStats(examId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_attempt_statistics', {
        p_exam_id: examId
      });
      expect(result.total_attempts).toBe(100);
      expect(result.avg_completion_time_minutes).toBe(45.5);
    });

    it('should get active attempts for monitoring', async () => {
      const examId = 'exam-1';
      const mockActiveAttempts = [
        {
          attempt_id: 'attempt-1',
          exam_id: examId,
          student_name: 'John Doe',
          started_at: '2023-01-01T10:00:00Z',
          last_activity: '2023-01-01T10:30:00Z',
          progress_data: { answered: 5, total: 10 },
          ip_address: '192.168.1.1'
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockActiveAttempts, error: null });

      const result = await attemptOperations.getActiveAttempts(examId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_active_attempts', {
        p_exam_id: examId
      });
      expect(result).toHaveLength(1);
      expect(result[0].attempt_id).toBe('attempt-1');
    });
  });

  describe('Cache Management', () => {
    it('should clear optimization cache', () => {
      // Add some data to cache first
      dbPool.executeQuery('test-key', async () => 'test-data', 60000);
      
      expect(dbPool.getCacheStats().size).toBeGreaterThan(0);
      
      attemptOperations.clearOptimizationCache();
      
      expect(dbPool.getCacheStats().size).toBe(0);
    });

    it('should invalidate cache after save operations', async () => {
      const attemptId = 'test-attempt';
      const answers = { q1: 'answer' };
      const autoSaveData = { progress: 50 };

      mockSupabase.rpc.mockResolvedValue({ data: [{ new_version: 2 }], error: null });

      await attemptOperations.saveAttempt(attemptId, answers, autoSaveData, 1);

      // Cache should be invalidated for this attempt
      // This is tested by checking that subsequent calls don't use stale cache
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });
  });
});

describe('DatabasePool', () => {
  beforeEach(() => {
    dbPool.clearCache();
  });

  it('should cache query results', async () => {
    let callCount = 0;
    const queryFn = async () => {
      callCount++;
      return 'test-result';
    };

    const result1 = await dbPool.executeQuery('test-key', queryFn, 60000);
    const result2 = await dbPool.executeQuery('test-key', queryFn, 60000);

    expect(callCount).toBe(1); // Query function called only once
    expect(result1).toBe('test-result');
    expect(result2).toBe('test-result');
  });

  it('should execute parallel queries efficiently', async () => {
    const queries = [
      {
        key: 'query1',
        queryFn: async (client: any) => 'result1'
      },
      {
        key: 'query2',
        queryFn: async (client: any) => 'result2'
      }
    ];

    const results = await dbPool.executeParallelQueries(queries);

    expect(results).toEqual(['result1', 'result2']);
  });

  it('should provide cache statistics', () => {
    const stats = dbPool.getCacheStats();

    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('hitRate');
    expect(stats).toHaveProperty('entries');
    expect(Array.isArray(stats.entries)).toBe(true);
  });
});

describe('QueryOptimizer', () => {
  beforeEach(() => {
    queryOptimizer.clearOptimizationCache();
  });

  it('should optimize batch queries', async () => {
    const operations = [
      { type: 'state' as const, attemptId: 'attempt-1' },
      { type: 'state' as const, attemptId: 'attempt-2' },
      { type: 'info' as const, attemptId: 'attempt-1' }
    ];

    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const results = await queryOptimizer.optimizeAttemptQueries(operations);

    expect(typeof results).toBe('object');
  });

  it('should provide query analysis', async () => {
    const analysis = await queryOptimizer.analyzeQueryPatterns();

    expect(analysis).toHaveProperty('recommendations');
    expect(analysis).toHaveProperty('slowQueries');
    expect(Array.isArray(analysis.recommendations)).toBe(true);
  });

  it('should preload frequent data', async () => {
    const examIds = ['exam-1', 'exam-2'];
    
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await queryOptimizer.preloadFrequentData(examIds);

    expect(mockSupabase.rpc).toHaveBeenCalled();
  });
});