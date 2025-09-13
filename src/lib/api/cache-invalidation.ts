/**
 * Cache invalidation triggers and management system
 * Handles automatic cache invalidation based on data changes
 */

import { supabaseServer } from '@/lib/supabase/server';
import { cacheManager } from './cache-manager';
import { CacheInvalidationUtils } from './cache-utils';
import { CacheAnalyticsCollector } from './cache-analytics';

/**
 * Database change event interface
 */
export interface DatabaseChangeEvent {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  oldRecord?: any;
  newRecord?: any;
  timestamp: Date;
}

/**
 * Cache invalidation rule interface
 */
export interface CacheInvalidationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggers: {
    tables: string[];
    operations: ('INSERT' | 'UPDATE' | 'DELETE')[];
    conditions?: (event: DatabaseChangeEvent) => boolean;
  };
  actions: {
    tags: string[];
    patterns?: RegExp[];
    customHandler?: (event: DatabaseChangeEvent) => Promise<void>;
  };
  priority: number; // Higher priority rules execute first
}

/**
 * Predefined cache invalidation rules
 */
export const CACHE_INVALIDATION_RULES: CacheInvalidationRule[] = [
  {
    id: 'system-config-changes',
    name: 'System Configuration Changes',
    description: 'Invalidate system configuration cache when app_config changes',
    enabled: true,
    triggers: {
      tables: ['app_config', 'app_settings'],
      operations: ['INSERT', 'UPDATE', 'DELETE']
    },
    actions: {
      tags: ['system', 'config', 'settings']
    },
    priority: 100
  },
  {
    id: 'exam-changes',
    name: 'Exam Data Changes',
    description: 'Invalidate exam-related cache when exam data changes',
    enabled: true,
    triggers: {
      tables: ['exams', 'questions'],
      operations: ['INSERT', 'UPDATE', 'DELETE']
    },
    actions: {
      tags: ['exams', 'active'],
      customHandler: async (event) => {
        // Invalidate specific exam cache if exam ID is available
        const examId = event.newRecord?.id || event.oldRecord?.id;
        if (examId) {
          await cacheManager.invalidateByTags([`exam-${examId}`]);
        }
      }
    },
    priority: 90
  },
  {
    id: 'student-changes',
    name: 'Student Data Changes',
    description: 'Invalidate student-specific cache when student data changes',
    enabled: true,
    triggers: {
      tables: ['students'],
      operations: ['INSERT', 'UPDATE', 'DELETE']
    },
    actions: {
      tags: ['students'],
      customHandler: async (event) => {
        // Invalidate specific student cache if student code is available
        const studentCode = event.newRecord?.code || event.oldRecord?.code;
        if (studentCode) {
          await cacheManager.invalidateByTags([`student-${studentCode}`]);
        }
      }
    },
    priority: 80
  },
  {
    id: 'attempt-changes',
    name: 'Attempt Data Changes',
    description: 'Invalidate attempt-related cache when attempt data changes',
    enabled: true,
    triggers: {
      tables: ['student_exam_attempts', 'exam_attempts', 'attempt_answers'],
      operations: ['INSERT', 'UPDATE', 'DELETE']
    },
    actions: {
      tags: ['attempts'],
      customHandler: async (event) => {
        // Invalidate specific attempt and related caches
        const attemptId = event.newRecord?.attempt_id || event.oldRecord?.attempt_id;
        const examId = event.newRecord?.exam_id || event.oldRecord?.exam_id;
        const studentCode = event.newRecord?.student_code || event.oldRecord?.student_code;
        
        const tagsToInvalidate = [];
        if (attemptId) tagsToInvalidate.push(`attempt-${attemptId}`);
        if (examId) tagsToInvalidate.push(`exam-${examId}`);
        if (studentCode) tagsToInvalidate.push(`student-${studentCode}`);
        
        if (tagsToInvalidate.length > 0) {
          await cacheManager.invalidateByTags(tagsToInvalidate);
        }
      }
    },
    priority: 70
  },
  {
    id: 'results-changes',
    name: 'Results Data Changes',
    description: 'Invalidate analytics and results cache when results change',
    enabled: true,
    triggers: {
      tables: ['exam_results'],
      operations: ['INSERT', 'UPDATE', 'DELETE']
    },
    actions: {
      tags: ['analytics', 'results', 'reports']
    },
    priority: 60
  }
];

/**
 * Cache invalidation manager
 */
export class CacheInvalidationManager {
  private rules: Map<string, CacheInvalidationRule> = new Map();
  private isListening = false;
  private invalidationQueue: DatabaseChangeEvent[] = [];
  private processingQueue = false;

  constructor() {
    // Load default rules
    CACHE_INVALIDATION_RULES.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  /**
   * Start listening for database changes
   */
  async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      const client = supabaseServer();
      
      // Set up real-time subscriptions for each table
      const tables = this.getWatchedTables();
      
      for (const table of tables) {
        client
          .channel(`cache-invalidation-${table}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: table
            },
            (payload) => {
              this.handleDatabaseChange({
                table: table,
                operation: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                oldRecord: payload.old,
                newRecord: payload.new,
                timestamp: new Date()
              });
            }
          )
          .subscribe();
      }

      this.isListening = true;
      console.log('Cache invalidation manager started listening for database changes');
    } catch (error) {
      console.error('Failed to start cache invalidation listener:', error);
    }
  }

  /**
   * Stop listening for database changes
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    try {
      const client = supabaseServer();
      await client.removeAllChannels();
      this.isListening = false;
      console.log('Cache invalidation manager stopped listening');
    } catch (error) {
      console.error('Failed to stop cache invalidation listener:', error);
    }
  }

  /**
   * Handle database change event
   */
  private async handleDatabaseChange(event: DatabaseChangeEvent): Promise<void> {
    // Add to queue for batch processing
    this.invalidationQueue.push(event);
    
    // Process queue if not already processing
    if (!this.processingQueue) {
      this.processInvalidationQueue();
    }
  }

  /**
   * Process invalidation queue in batches
   */
  private async processInvalidationQueue(): Promise<void> {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    
    try {
      while (this.invalidationQueue.length > 0) {
        const batch = this.invalidationQueue.splice(0, 10); // Process 10 events at a time
        await this.processBatch(batch);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error processing invalidation queue:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Process a batch of database change events
   */
  private async processBatch(events: DatabaseChangeEvent[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Group events by table for efficient processing
      const eventsByTable = new Map<string, DatabaseChangeEvent[]>();
      
      for (const event of events) {
        if (!eventsByTable.has(event.table)) {
          eventsByTable.set(event.table, []);
        }
        eventsByTable.get(event.table)!.push(event);
      }

      // Process each table's events
      for (const [table, tableEvents] of eventsByTable) {
        await this.processTableEvents(table, tableEvents);
      }

      // Record analytics
      CacheAnalyticsCollector.recordOperation(
        'invalidation-batch',
        'hit',
        Date.now() - startTime,
        'invalidation',
        events.length,
        0,
        ['invalidation', 'batch']
      );

      console.log(`Processed cache invalidation batch: ${events.length} events in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('Error processing invalidation batch:', error);
      
      CacheAnalyticsCollector.recordOperation(
        'invalidation-batch',
        'miss',
        Date.now() - startTime,
        'invalidation',
        events.length,
        0,
        ['invalidation', 'batch', 'error']
      );
    }
  }

  /**
   * Process events for a specific table
   */
  private async processTableEvents(table: string, events: DatabaseChangeEvent[]): Promise<void> {
    // Get applicable rules for this table
    const applicableRules = Array.from(this.rules.values())
      .filter(rule => 
        rule.enabled && 
        rule.triggers.tables.includes(table)
      )
      .sort((a, b) => b.priority - a.priority);

    if (applicableRules.length === 0) return;

    // Collect all tags to invalidate
    const tagsToInvalidate = new Set<string>();
    const customHandlers: Array<() => Promise<void>> = [];

    for (const event of events) {
      for (const rule of applicableRules) {
        // Check if operation matches
        if (!rule.triggers.operations.includes(event.operation)) continue;

        // Check custom conditions if any
        if (rule.triggers.conditions && !rule.triggers.conditions(event)) continue;

        // Add tags to invalidate
        rule.actions.tags.forEach(tag => tagsToInvalidate.add(tag));

        // Add custom handler if any
        if (rule.actions.customHandler) {
          customHandlers.push(() => rule.actions.customHandler!(event));
        }
      }
    }

    // Execute invalidations
    if (tagsToInvalidate.size > 0) {
      const tags = Array.from(tagsToInvalidate);
      await cacheManager.invalidateByTags(tags);
      console.log(`Invalidated cache tags for table ${table}:`, tags);
    }

    // Execute custom handlers
    if (customHandlers.length > 0) {
      await Promise.all(customHandlers.map(handler => handler()));
    }
  }

  /**
   * Get all tables being watched by invalidation rules
   */
  private getWatchedTables(): string[] {
    const tables = new Set<string>();
    
    for (const rule of this.rules.values()) {
      if (rule.enabled) {
        rule.triggers.tables.forEach(table => tables.add(table));
      }
    }
    
    return Array.from(tables);
  }

  /**
   * Add or update invalidation rule
   */
  addRule(rule: CacheInvalidationRule): void {
    this.rules.set(rule.id, rule);
    
    // If we're already listening and this rule watches new tables, restart listening
    if (this.isListening) {
      this.stopListening().then(() => this.startListening());
    }
  }

  /**
   * Remove invalidation rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Enable or disable rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get all rules
   */
  getRules(): CacheInvalidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): CacheInvalidationRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Manually trigger invalidation for specific data change
   */
  async triggerInvalidation(event: DatabaseChangeEvent): Promise<void> {
    await this.handleDatabaseChange(event);
  }

  /**
   * Get invalidation statistics
   */
  getStatistics(): {
    rulesCount: number;
    enabledRulesCount: number;
    watchedTablesCount: number;
    queueSize: number;
    isListening: boolean;
    isProcessing: boolean;
  } {
    return {
      rulesCount: this.rules.size,
      enabledRulesCount: Array.from(this.rules.values()).filter(r => r.enabled).length,
      watchedTablesCount: this.getWatchedTables().length,
      queueSize: this.invalidationQueue.length,
      isListening: this.isListening,
      isProcessing: this.processingQueue
    };
  }
}

/**
 * Manual cache invalidation utilities
 */
export class ManualCacheInvalidation {
  /**
   * Invalidate cache by data type
   */
  static async invalidateByDataType(dataType: string): Promise<{ invalidated: number; tags: string[] }> {
    const tags = this.getTagsForDataType(dataType);
    const result = await cacheManager.invalidateByTags(tags);
    
    return {
      invalidated: result.memory + result.edge + result.database,
      tags
    };
  }

  /**
   * Invalidate cache by specific entity
   */
  static async invalidateByEntity(
    entityType: 'exam' | 'student' | 'attempt',
    entityId: string
  ): Promise<{ invalidated: number; tags: string[] }> {
    const tags = [`${entityType}-${entityId}`];
    const result = await cacheManager.invalidateByTags(tags);
    
    return {
      invalidated: result.memory + result.edge + result.database,
      tags
    };
  }

  /**
   * Invalidate all cache
   */
  static async invalidateAll(): Promise<void> {
    cacheManager.clear();
    console.log('All cache cleared manually');
  }

  /**
   * Invalidate cache by pattern
   */
  static invalidateByPattern(pattern: string): number {
    const regex = new RegExp(pattern);
    return cacheManager.invalidateByPattern(regex);
  }

  /**
   * Get tags for data type
   */
  private static getTagsForDataType(dataType: string): string[] {
    const tagMap: Record<string, string[]> = {
      'system': ['system', 'config', 'settings'],
      'exams': ['exams', 'active'],
      'students': ['students'],
      'attempts': ['attempts'],
      'analytics': ['analytics', 'reports', 'results'],
      'config': ['config', 'settings'],
      'all': ['system', 'config', 'settings', 'exams', 'active', 'students', 'attempts', 'analytics', 'reports', 'results']
    };

    return tagMap[dataType] || [dataType];
  }
}

// Global cache invalidation manager instance
export const cacheInvalidationManager = new CacheInvalidationManager();

// Auto-start listening when module is loaded
if (typeof window === 'undefined') { // Server-side only
  cacheInvalidationManager.startListening().catch(console.error);
}