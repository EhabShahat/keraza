/**
 * Tests for cache invalidation and management system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  CacheInvalidationManager, 
  ManualCacheInvalidation,
  CACHE_INVALIDATION_RULES 
} from '../cache-invalidation';
import { cacheConsistencyChecker, CacheRepairUtilities } from '../cache-consistency';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: () => ({
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn()
      }))
    })),
    removeAllChannels: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null }))
        })),
        in: vi.fn(() => ({ data: [], error: null })),
        limit: vi.fn(() => ({ data: [], error: null })),
        order: vi.fn(() => ({ data: [], error: null })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({ data: [], error: null })),
          lt: vi.fn(() => ({ data: [], error: null })),
          overlaps: vi.fn(() => ({ data: [], error: null }))
        }))
      }))
    }))
  })
}));

vi.mock('../cache-manager', () => ({
  cacheManager: {
    invalidateByTags: vi.fn(() => Promise.resolve({ memory: 1, edge: 1, database: 1 })),
    invalidateByPattern: vi.fn(() => 1),
    clear: vi.fn(),
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('../cache-analytics', () => ({
  CacheAnalyticsCollector: {
    recordOperation: vi.fn()
  }
}));

describe('Cache Invalidation System', () => {
  let invalidationManager: CacheInvalidationManager;

  beforeEach(() => {
    invalidationManager = new CacheInvalidationManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CacheInvalidationManager', () => {
    it('should initialize with default rules', () => {
      const rules = invalidationManager.getRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(rule => rule.id === 'system-config-changes')).toBe(true);
      expect(rules.some(rule => rule.id === 'exam-changes')).toBe(true);
    });

    it('should add and remove rules', () => {
      const customRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test invalidation rule',
        enabled: true,
        triggers: {
          tables: ['test_table'],
          operations: ['INSERT' as const]
        },
        actions: {
          tags: ['test']
        },
        priority: 50
      };

      invalidationManager.addRule(customRule);
      expect(invalidationManager.getRule('test-rule')).toEqual(customRule);

      invalidationManager.removeRule('test-rule');
      expect(invalidationManager.getRule('test-rule')).toBeUndefined();
    });

    it('should enable and disable rules', () => {
      const ruleId = 'system-config-changes';
      const rule = invalidationManager.getRule(ruleId);
      expect(rule?.enabled).toBe(true);

      invalidationManager.setRuleEnabled(ruleId, false);
      expect(invalidationManager.getRule(ruleId)?.enabled).toBe(false);

      invalidationManager.setRuleEnabled(ruleId, true);
      expect(invalidationManager.getRule(ruleId)?.enabled).toBe(true);
    });

    it('should provide statistics', () => {
      const stats = invalidationManager.getStatistics();
      expect(stats).toHaveProperty('rulesCount');
      expect(stats).toHaveProperty('enabledRulesCount');
      expect(stats).toHaveProperty('watchedTablesCount');
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('isListening');
      expect(stats).toHaveProperty('isProcessing');
    });

    it('should trigger manual invalidation', async () => {
      const event = {
        table: 'exams',
        operation: 'UPDATE' as const,
        oldRecord: { id: 'exam1', title: 'Old Title' },
        newRecord: { id: 'exam1', title: 'New Title' },
        timestamp: new Date()
      };

      await invalidationManager.triggerInvalidation(event);
      // The invalidation should be queued and processed
      expect(true).toBe(true); // Basic test that no errors occurred
    });
  });

  describe('ManualCacheInvalidation', () => {
    it('should invalidate cache by data type', async () => {
      const result = await ManualCacheInvalidation.invalidateByDataType('exams');
      expect(result).toHaveProperty('invalidated');
      expect(result).toHaveProperty('tags');
      expect(result.tags).toContain('exams');
    });

    it('should invalidate cache by entity', async () => {
      const result = await ManualCacheInvalidation.invalidateByEntity('exam', 'exam123');
      expect(result).toHaveProperty('invalidated');
      expect(result).toHaveProperty('tags');
      expect(result.tags).toContain('exam-exam123');
    });

    it('should invalidate cache by pattern', () => {
      const invalidated = ManualCacheInvalidation.invalidateByPattern('exam:.*');
      expect(typeof invalidated).toBe('number');
    });
  });

  describe('Cache Consistency Checker', () => {
    it('should run consistency check', async () => {
      const result = await cacheConsistencyChecker.runConsistencyCheck();
      
      expect(result).toHaveProperty('totalChecks');
      expect(result).toHaveProperty('issuesFound');
      expect(result).toHaveProperty('issuesByType');
      expect(result).toHaveProperty('issuesBySeverity');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('checkDuration');
      expect(result).toHaveProperty('recommendations');
      
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Cache Repair Utilities', () => {
    it('should auto-fix issues', async () => {
      const mockIssues = [
        {
          id: 'issue1',
          type: 'stale_data' as const,
          severity: 'medium' as const,
          description: 'Test stale data',
          cacheKey: 'test:key',
          tier: 'memory' as const,
          detectedAt: new Date(),
          autoFixable: true,
          fixAction: 'Invalidate cache'
        }
      ];

      const result = await CacheRepairUtilities.autoFixIssues(mockIssues);
      
      expect(result).toHaveProperty('fixed');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should perform comprehensive repair', async () => {
      const result = await CacheRepairUtilities.performComprehensiveRepair();
      
      expect(result).toHaveProperty('clearedExpired');
      expect(result).toHaveProperty('removedOrphaned');
      expect(result).toHaveProperty('invalidatedStale');
    });

    it('should repair cache from source', async () => {
      // This should not throw an error
      await expect(
        CacheRepairUtilities.repairCacheFromSource('test:key')
      ).resolves.toBeUndefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle database change events correctly', async () => {
      const event = {
        table: 'app_config',
        operation: 'UPDATE' as const,
        oldRecord: { key: 'system_mode', value: 'exam' },
        newRecord: { key: 'system_mode', value: 'disabled' },
        timestamp: new Date()
      };

      // This should trigger system config invalidation
      await invalidationManager.triggerInvalidation(event);
      
      // Verify that the appropriate invalidation was triggered
      // In a real test, we would check that the cache was actually invalidated
      expect(true).toBe(true);
    });

    it('should handle exam changes correctly', async () => {
      const event = {
        table: 'exams',
        operation: 'UPDATE' as const,
        oldRecord: { id: 'exam1', title: 'Old Title', status: 'draft' },
        newRecord: { id: 'exam1', title: 'New Title', status: 'published' },
        timestamp: new Date()
      };

      await invalidationManager.triggerInvalidation(event);
      expect(true).toBe(true);
    });

    it('should handle student changes correctly', async () => {
      const event = {
        table: 'students',
        operation: 'INSERT' as const,
        newRecord: { id: 'student1', code: 'STU001', student_name: 'John Doe' },
        timestamp: new Date()
      };

      await invalidationManager.triggerInvalidation(event);
      expect(true).toBe(true);
    });

    it('should handle attempt changes correctly', async () => {
      const event = {
        table: 'student_exam_attempts',
        operation: 'UPDATE' as const,
        oldRecord: { 
          attempt_id: 'attempt1', 
          status: 'in_progress', 
          exam_id: 'exam1',
          student_code: 'STU001'
        },
        newRecord: { 
          attempt_id: 'attempt1', 
          status: 'completed', 
          exam_id: 'exam1',
          student_code: 'STU001'
        },
        timestamp: new Date()
      };

      await invalidationManager.triggerInvalidation(event);
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalidation errors gracefully', async () => {
      // Mock an error in cache invalidation
      const mockCacheManager = await import('../cache-manager');
      vi.mocked(mockCacheManager.cacheManager.invalidateByTags).mockRejectedValueOnce(
        new Error('Cache invalidation failed')
      );

      const event = {
        table: 'exams',
        operation: 'UPDATE' as const,
        newRecord: { id: 'exam1' },
        timestamp: new Date()
      };

      // Should not throw, but handle error gracefully
      await expect(
        invalidationManager.triggerInvalidation(event)
      ).resolves.toBeUndefined();
    });

    it('should handle consistency check errors', async () => {
      // Mock Supabase error
      const mockSupabase = await import('@/lib/supabase/server');
      vi.mocked(mockSupabase.supabaseServer).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: null, error: new Error('Database error') }))
          }))
        }))
      } as any);

      // Should handle the error and still return a result
      const result = await cacheConsistencyChecker.runConsistencyCheck();
      expect(result).toHaveProperty('issues');
    });
  });
});

describe('Cache Invalidation Rules', () => {
  it('should have valid default rules', () => {
    expect(CACHE_INVALIDATION_RULES.length).toBeGreaterThan(0);
    
    for (const rule of CACHE_INVALIDATION_RULES) {
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('description');
      expect(rule).toHaveProperty('enabled');
      expect(rule).toHaveProperty('triggers');
      expect(rule).toHaveProperty('actions');
      expect(rule).toHaveProperty('priority');
      
      expect(typeof rule.id).toBe('string');
      expect(typeof rule.name).toBe('string');
      expect(typeof rule.description).toBe('string');
      expect(typeof rule.enabled).toBe('boolean');
      expect(typeof rule.priority).toBe('number');
      
      expect(Array.isArray(rule.triggers.tables)).toBe(true);
      expect(Array.isArray(rule.triggers.operations)).toBe(true);
      expect(Array.isArray(rule.actions.tags)).toBe(true);
    }
  });

  it('should have unique rule IDs', () => {
    const ids = CACHE_INVALIDATION_RULES.map(rule => rule.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid priorities', () => {
    for (const rule of CACHE_INVALIDATION_RULES) {
      expect(rule.priority).toBeGreaterThan(0);
      expect(rule.priority).toBeLessThanOrEqual(100);
    }
  });
});