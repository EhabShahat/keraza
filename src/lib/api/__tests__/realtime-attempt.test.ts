import { RealtimeAttemptManager } from '../realtime-attempt';
import { attemptOperations } from '../attempt-operations';

// Mock the attempt operations
jest.mock('../attempt-operations', () => ({
  attemptOperations: {
    getAttemptState: jest.fn(),
    saveAttempt: jest.fn(),
  }
}));

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: () => ({
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn()
      }))
    }))
  })
}));

describe('RealtimeAttemptManager', () => {
  let manager: RealtimeAttemptManager;
  const mockAttemptId = 'test-attempt-123';
  const mockConnectionId = 'conn-123';

  beforeEach(() => {
    manager = new RealtimeAttemptManager();
    jest.clearAllMocks();
  });

  describe('Real-time monitoring initialization', () => {
    it('should initialize real-time monitoring for an attempt', async () => {
      const mockAttemptState = {
        attempt_id: mockAttemptId,
        version: 1,
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        exam_id: 'exam-123',
        student_id: 'student-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (attemptOperations.getAttemptState as jest.Mock).mockResolvedValue(mockAttemptState);

      await manager.initializeRealtimeMonitoring(mockAttemptId, mockConnectionId);

      const syncStatus = manager.getSyncStatus(mockAttemptId);
      expect(syncStatus).toBeTruthy();
      expect(syncStatus?.attemptId).toBe(mockAttemptId);
      expect(syncStatus?.version).toBe(1);
    });

    it('should handle multiple connections for the same attempt', async () => {
      const mockAttemptState = {
        attempt_id: mockAttemptId,
        version: 1,
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        exam_id: 'exam-123',
        student_id: 'student-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (attemptOperations.getAttemptState as jest.Mock).mockResolvedValue(mockAttemptState);

      await manager.initializeRealtimeMonitoring(mockAttemptId, 'conn-1');
      await manager.initializeRealtimeMonitoring(mockAttemptId, 'conn-2');

      const stats = manager.getRealtimeStats();
      expect(stats.activeConnections).toBe(2);
      expect(stats.activeAttempts).toBe(1);
    });
  });

  describe('Optimized auto-save', () => {
    beforeEach(async () => {
      const mockAttemptState = {
        attempt_id: mockAttemptId,
        version: 1,
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        exam_id: 'exam-123',
        student_id: 'student-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (attemptOperations.getAttemptState as jest.Mock).mockResolvedValue(mockAttemptState);
      await manager.initializeRealtimeMonitoring(mockAttemptId, mockConnectionId);
    });

    it('should process auto-save with batching', async () => {
      const changes = [
        {
          type: 'answer_update',
          questionId: 'q1',
          answer: 'Answer 1',
          timestamp: new Date().toISOString()
        },
        {
          type: 'answer_update',
          questionId: 'q2',
          answer: 'Answer 2',
          timestamp: new Date().toISOString()
        },
        {
          type: 'auto_save',
          autoSaveData: { progress: 50 },
          timestamp: new Date().toISOString()
        }
      ];

      (attemptOperations.saveAttempt as jest.Mock).mockResolvedValue({
        new_version: 2
      });

      const result = await manager.optimizedAutoSave(mockAttemptId, changes, {
        interval: 5000,
        maxRetries: 3,
        conflictStrategy: 'merge',
        batchSize: 5
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe(2);
      expect(attemptOperations.saveAttempt).toHaveBeenCalledWith(
        mockAttemptId,
        { q1: 'Answer 1', q2: 'Answer 2' },
        { progress: 50 },
        1
      );
    });

    it('should handle version conflicts during auto-save', async () => {
      const changes = [
        {
          type: 'answer_update',
          questionId: 'q1',
          answer: 'Answer 1',
          timestamp: new Date().toISOString()
        }
      ];

      const mockLatestState = {
        attempt_id: mockAttemptId,
        version: 3,
        answers: { q1: 'Server Answer' },
        auto_save_data: {},
        completion_status: 'in_progress',
        exam_id: 'exam-123',
        student_id: 'student-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (attemptOperations.saveAttempt as jest.Mock).mockResolvedValue({
        new_version: 1,
        conflict: true,
        latest: mockLatestState
      });

      (attemptOperations.getAttemptState as jest.Mock).mockResolvedValue(mockLatestState);

      const result = await manager.optimizedAutoSave(mockAttemptId, changes, {
        interval: 5000,
        maxRetries: 3,
        conflictStrategy: 'merge',
        batchSize: 5
      });

      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.length).toBeGreaterThan(0);
    });
  });

  describe('Attempt synchronization', () => {
    beforeEach(async () => {
      const mockAttemptState = {
        attempt_id: mockAttemptId,
        version: 1,
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        exam_id: 'exam-123',
        student_id: 'student-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (attemptOperations.getAttemptState as jest.Mock).mockResolvedValue(mockAttemptState);
      await manager.initializeRealtimeMonitoring(mockAttemptId, mockConnectionId);
    });

    it('should synchronize when no conflicts exist', async () => {
      const localChanges = [
        {
          type: 'answer_update',
          questionId: 'q1',
          answer: 'New Answer',
          timestamp: new Date().toISOString()
        }
      ];

      (attemptOperations.saveAttempt as jest.Mock).mockResolvedValue({
        new_version: 2
      });

      const result = await manager.synchronizeAttempt(mockAttemptId, 1, localChanges);

      expect(result.synchronized).toBe(true);
      expect(result.newVersion).toBe(2);
      expect(result.conflicts).toBeUndefined();
    });

    it('should detect and handle conflicts during synchronization', async () => {
      const localChanges = [
        {
          type: 'answer_update',
          questionId: 'q1',
          answer: 'Local Answer',
          timestamp: new Date().toISOString()
        }
      ];

      const serverState = {
        attempt_id: mockAttemptId,
        version: 2,
        answers: { q1: 'Server Answer' },
        auto_save_data: {},
        completion_status: 'in_progress',
        exam_id: 'exam-123',
        student_id: 'student-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (attemptOperations.getAttemptState as jest.Mock).mockResolvedValue(serverState);

      const result = await manager.synchronizeAttempt(mockAttemptId, 1, localChanges);

      expect(result.synchronized).toBe(false);
      expect(result.newVersion).toBe(2);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.length).toBeGreaterThan(0);
    });
  });

  describe('Force synchronization', () => {
    it('should force synchronization and update sync state', async () => {
      const mockAttemptState = {
        attempt_id: mockAttemptId,
        version: 3,
        answers: { q1: 'Synced Answer' },
        auto_save_data: {},
        completion_status: 'in_progress',
        exam_id: 'exam-123',
        student_id: 'student-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (attemptOperations.getAttemptState as jest.Mock).mockResolvedValue(mockAttemptState);
      await manager.initializeRealtimeMonitoring(mockAttemptId, mockConnectionId);

      await manager.forceSynchronization(mockAttemptId);

      const syncStatus = manager.getSyncStatus(mockAttemptId);
      expect(syncStatus?.version).toBe(3);
      expect(syncStatus?.pendingChanges).toHaveLength(0);
    });
  });

  describe('Real-time statistics', () => {
    it('should provide accurate real-time statistics', async () => {
      const mockAttemptState = {
        attempt_id: mockAttemptId,
        version: 1,
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        exam_id: 'exam-123',
        student_id: 'student-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (attemptOperations.getAttemptState as jest.Mock).mockResolvedValue(mockAttemptState);

      await manager.initializeRealtimeMonitoring(mockAttemptId, 'conn-1');
      await manager.initializeRealtimeMonitoring(mockAttemptId, 'conn-2');
      await manager.initializeRealtimeMonitoring('attempt-2', 'conn-3');

      const stats = manager.getRealtimeStats();

      expect(stats.activeConnections).toBe(3);
      expect(stats.activeAttempts).toBe(2);
      expect(stats.syncStates).toBe(2);
    });
  });

  describe('Connection cleanup', () => {
    it('should clean up resources when connections close', async () => {
      const mockAttemptState = {
        attempt_id: mockAttemptId,
        version: 1,
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        exam_id: 'exam-123',
        student_id: 'student-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (attemptOperations.getAttemptState as jest.Mock).mockResolvedValue(mockAttemptState);

      await manager.initializeRealtimeMonitoring(mockAttemptId, mockConnectionId);
      
      let stats = manager.getRealtimeStats();
      expect(stats.activeConnections).toBe(1);
      expect(stats.activeAttempts).toBe(1);

      manager.cleanupRealtimeMonitoring(mockAttemptId, mockConnectionId);

      stats = manager.getRealtimeStats();
      expect(stats.activeConnections).toBe(0);
      expect(stats.activeAttempts).toBe(0);
    });
  });
});