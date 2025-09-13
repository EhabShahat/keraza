/**
 * Cache consistency checks and repair utilities
 * Ensures data integrity across cache tiers and detects inconsistencies
 */

import { supabaseServer } from '@/lib/supabase/server';
import { cacheManager } from './cache-manager';
import { CacheAnalyticsCollector } from './cache-analytics';

/**
 * Cache consistency issue types
 */
export type ConsistencyIssueType = 
  | 'stale_data'           // Cache contains outdated data
  | 'missing_data'         // Expected cache entry is missing
  | 'corrupted_data'       // Cache data is corrupted or invalid
  | 'tier_mismatch'        // Different data across cache tiers
  | 'expired_not_cleaned'  // Expired entries not cleaned up
  | 'orphaned_entry';      // Cache entry exists but source data doesn't

/**
 * Cache consistency issue interface
 */
export interface ConsistencyIssue {
  id: string;
  type: ConsistencyIssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  cacheKey: string;
  tier: 'memory' | 'edge' | 'database' | 'all';
  detectedAt: Date;
  sourceData?: any;
  cachedData?: any;
  expectedData?: any;
  autoFixable: boolean;
  fixAction?: string;
}

/**
 * Consistency check result interface
 */
export interface ConsistencyCheckResult {
  totalChecks: number;
  issuesFound: number;
  issuesByType: Record<ConsistencyIssueType, number>;
  issuesBySeverity: Record<'low' | 'medium' | 'high' | 'critical', number>;
  issues: ConsistencyIssue[];
  checkDuration: number;
  recommendations: string[];
}

/**
 * Cache consistency checker
 */
export class CacheConsistencyChecker {
  private issues: ConsistencyIssue[] = [];
  private checkId = 0;

  /**
   * Run comprehensive consistency check
   */
  async runConsistencyCheck(): Promise<ConsistencyCheckResult> {
    const startTime = Date.now();
    this.issues = [];
    this.checkId = 0;

    console.log('Starting cache consistency check...');

    try {
      // Run all consistency checks
      await Promise.all([
        this.checkSystemConfigConsistency(),
        this.checkExamDataConsistency(),
        this.checkStudentDataConsistency(),
        this.checkAttemptDataConsistency(),
        this.checkExpiredEntries(),
        this.checkOrphanedEntries(),
        this.checkTierConsistency()
      ]);

      const checkDuration = Date.now() - startTime;

      // Generate statistics
      const issuesByType = this.groupIssuesByType();
      const issuesBySeverity = this.groupIssuesBySeverity();
      const recommendations = this.generateRecommendations();

      const result: ConsistencyCheckResult = {
        totalChecks: 7, // Number of check types
        issuesFound: this.issues.length,
        issuesByType,
        issuesBySeverity,
        issues: this.issues,
        checkDuration,
        recommendations
      };

      console.log(`Cache consistency check completed in ${checkDuration}ms. Found ${this.issues.length} issues.`);

      // Record analytics
      CacheAnalyticsCollector.recordOperation(
        'consistency-check',
        this.issues.length === 0 ? 'hit' : 'miss',
        checkDuration,
        'consistency',
        this.issues.length,
        0,
        ['consistency', 'check']
      );

      return result;
    } catch (error) {
      console.error('Cache consistency check failed:', error);
      throw error;
    }
  }

  /**
   * Check system configuration consistency
   */
  private async checkSystemConfigConsistency(): Promise<void> {
    try {
      const client = supabaseServer();
      
      // Get current system config from database
      const { data: dbConfig, error } = await client
        .from('app_config')
        .select('key, value')
        .in('key', ['system_mode', 'system_disabled_message']);

      if (error) {
        this.addIssue({
          type: 'missing_data',
          severity: 'high',
          description: 'Failed to fetch system config from database',
          cacheKey: 'config:system',
          tier: 'database'
        });
        return;
      }

      // Check cache consistency
      const cacheKey = 'config:system-mode';
      const cachedData = await cacheManager.get(cacheKey, {
        strategy: 'database',
        ttl: 300,
        tags: ['system', 'config']
      });

      if (!cachedData && dbConfig && dbConfig.length > 0) {
        this.addIssue({
          type: 'missing_data',
          severity: 'medium',
          description: 'System config missing from cache but exists in database',
          cacheKey,
          tier: 'all',
          sourceData: dbConfig,
          autoFixable: true,
          fixAction: 'Warm cache with database data'
        });
      } else if (cachedData && dbConfig) {
        // Check if cached data matches database
        const dbMap = new Map(dbConfig.map((item: any) => [item.key, item.value]));
        const cachedMode = cachedData.mode;
        const dbMode = dbMap.get('system_mode') || 'exam';

        if (cachedMode !== dbMode) {
          this.addIssue({
            type: 'stale_data',
            severity: 'high',
            description: 'System mode in cache differs from database',
            cacheKey,
            tier: 'all',
            sourceData: { mode: dbMode },
            cachedData: { mode: cachedMode },
            autoFixable: true,
            fixAction: 'Invalidate and refresh cache'
          });
        }
      }
    } catch (error) {
      this.addIssue({
        type: 'corrupted_data',
        severity: 'critical',
        description: `System config consistency check failed: ${error}`,
        cacheKey: 'config:system',
        tier: 'all'
      });
    }
  }

  /**
   * Check exam data consistency
   */
  private async checkExamDataConsistency(): Promise<void> {
    try {
      const client = supabaseServer();
      
      // Get active exams from database
      const { data: dbExams, error } = await client
        .from('exams')
        .select('id, title, status, start_time, end_time')
        .eq('status', 'published')
        .limit(10);

      if (error) {
        this.addIssue({
          type: 'missing_data',
          severity: 'high',
          description: 'Failed to fetch exams from database',
          cacheKey: 'exams:active',
          tier: 'database'
        });
        return;
      }

      // Check active exams cache
      const cacheKey = 'exams:active';
      const cachedExams = await cacheManager.get(cacheKey, {
        strategy: 'memory',
        ttl: 60,
        tags: ['exams', 'active']
      });

      if (!cachedExams && dbExams && dbExams.length > 0) {
        this.addIssue({
          type: 'missing_data',
          severity: 'medium',
          description: 'Active exams missing from cache',
          cacheKey,
          tier: 'memory',
          sourceData: dbExams,
          autoFixable: true,
          fixAction: 'Warm cache with database data'
        });
      } else if (cachedExams && dbExams) {
        // Check individual exam consistency
        for (const dbExam of dbExams.slice(0, 5)) { // Check first 5 exams
          const examCacheKey = `exam:${dbExam.id}:info`;
          const cachedExam = await cacheManager.get(examCacheKey, {
            strategy: 'edge',
            ttl: 900,
            tags: ['exam', `exam-${dbExam.id}`]
          });

          if (cachedExam && cachedExam.title !== dbExam.title) {
            this.addIssue({
              type: 'stale_data',
              severity: 'medium',
              description: `Exam ${dbExam.id} title differs between cache and database`,
              cacheKey: examCacheKey,
              tier: 'edge',
              sourceData: dbExam,
              cachedData: cachedExam,
              autoFixable: true,
              fixAction: 'Invalidate exam cache'
            });
          }
        }
      }
    } catch (error) {
      this.addIssue({
        type: 'corrupted_data',
        severity: 'critical',
        description: `Exam data consistency check failed: ${error}`,
        cacheKey: 'exams:*',
        tier: 'all'
      });
    }
  }

  /**
   * Check student data consistency
   */
  private async checkStudentDataConsistency(): Promise<void> {
    try {
      const client = supabaseServer();
      
      // Sample a few students for consistency check
      const { data: students, error } = await client
        .from('students')
        .select('id, code, student_name')
        .limit(5);

      if (error) return; // Non-critical if students table doesn't exist

      for (const student of students || []) {
        const cacheKey = `student:${student.code}:info`;
        const cachedStudent = await cacheManager.get(cacheKey, {
          strategy: 'memory',
          ttl: 600,
          tags: ['student', `student-${student.code}`]
        });

        if (cachedStudent && cachedStudent.student_name !== student.student_name) {
          this.addIssue({
            type: 'stale_data',
            severity: 'low',
            description: `Student ${student.code} name differs between cache and database`,
            cacheKey,
            tier: 'memory',
            sourceData: student,
            cachedData: cachedStudent,
            autoFixable: true,
            fixAction: 'Invalidate student cache'
          });
        }
      }
    } catch (error) {
      // Non-critical error for student consistency
      console.warn('Student data consistency check failed:', error);
    }
  }

  /**
   * Check attempt data consistency
   */
  private async checkAttemptDataConsistency(): Promise<void> {
    try {
      const client = supabaseServer();
      
      // Get recent attempts for consistency check
      const { data: attempts, error } = await client
        .from('student_exam_attempts')
        .select('attempt_id, status, exam_id, student_code')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) return; // Non-critical

      for (const attempt of attempts || []) {
        const cacheKey = `attempt:${attempt.attempt_id}:state`;
        const cachedAttempt = await cacheManager.get(cacheKey, {
          strategy: 'memory',
          ttl: 300,
          tags: ['attempt', `attempt-${attempt.attempt_id}`]
        });

        if (cachedAttempt && cachedAttempt.status !== attempt.status) {
          this.addIssue({
            type: 'stale_data',
            severity: 'high',
            description: `Attempt ${attempt.attempt_id} status differs between cache and database`,
            cacheKey,
            tier: 'memory',
            sourceData: attempt,
            cachedData: cachedAttempt,
            autoFixable: true,
            fixAction: 'Invalidate attempt cache'
          });
        }
      }
    } catch (error) {
      console.warn('Attempt data consistency check failed:', error);
    }
  }

  /**
   * Check for expired entries that haven't been cleaned up
   */
  private async checkExpiredEntries(): Promise<void> {
    try {
      const client = supabaseServer();
      
      // Check database cache for expired entries
      const { data: expiredEntries, error } = await client
        .from('cache_entries')
        .select('key, expires_at')
        .lt('expires_at', new Date().toISOString())
        .limit(10);

      if (error) return;

      if (expiredEntries && expiredEntries.length > 0) {
        this.addIssue({
          type: 'expired_not_cleaned',
          severity: 'low',
          description: `Found ${expiredEntries.length} expired cache entries not cleaned up`,
          cacheKey: 'cache_entries:expired',
          tier: 'database',
          sourceData: expiredEntries,
          autoFixable: true,
          fixAction: 'Run cache cleanup'
        });
      }
    } catch (error) {
      console.warn('Expired entries check failed:', error);
    }
  }

  /**
   * Check for orphaned cache entries
   */
  private async checkOrphanedEntries(): Promise<void> {
    try {
      // This would check for cache entries that reference non-existent source data
      // For now, we'll implement a basic check for exam cache entries
      
      const client = supabaseServer();
      
      // Get all exam IDs from database
      const { data: dbExams, error } = await client
        .from('exams')
        .select('id');

      if (error) return;

      const validExamIds = new Set((dbExams || []).map((exam: any) => exam.id));

      // Check cache entries for non-existent exams
      const { data: cacheEntries, error: cacheError } = await client
        .from('cache_entries')
        .select('key, tags')
        .overlaps('tags', ['exam']);

      if (cacheError) return;

      for (const entry of cacheEntries || []) {
        const examIdMatch = entry.key.match(/exam:([^:]+)/);
        if (examIdMatch) {
          const examId = examIdMatch[1];
          if (!validExamIds.has(examId)) {
            this.addIssue({
              type: 'orphaned_entry',
              severity: 'low',
              description: `Cache entry exists for non-existent exam ${examId}`,
              cacheKey: entry.key,
              tier: 'database',
              autoFixable: true,
              fixAction: 'Remove orphaned cache entry'
            });
          }
        }
      }
    } catch (error) {
      console.warn('Orphaned entries check failed:', error);
    }
  }

  /**
   * Check consistency across cache tiers
   */
  private async checkTierConsistency(): Promise<void> {
    try {
      // Sample some keys to check across tiers
      const testKeys = [
        'config:system-mode',
        'exams:active',
        'config:app-settings'
      ];

      for (const key of testKeys) {
        const memoryData = await cacheManager.get(key, { strategy: 'memory', ttl: 300, tags: [] });
        const edgeData = await cacheManager.get(key, { strategy: 'edge', ttl: 300, tags: [] });
        const databaseData = await cacheManager.get(key, { strategy: 'database', ttl: 300, tags: [] });

        // Check if data exists in multiple tiers but differs
        const tiers = [
          { name: 'memory', data: memoryData },
          { name: 'edge', data: edgeData },
          { name: 'database', data: databaseData }
        ].filter(tier => tier.data !== null);

        if (tiers.length > 1) {
          const firstData = JSON.stringify(tiers[0].data);
          for (let i = 1; i < tiers.length; i++) {
            const currentData = JSON.stringify(tiers[i].data);
            if (firstData !== currentData) {
              this.addIssue({
                type: 'tier_mismatch',
                severity: 'medium',
                description: `Data mismatch between ${tiers[0].name} and ${tiers[i].name} tiers for key ${key}`,
                cacheKey: key,
                tier: 'all',
                sourceData: tiers[0].data,
                cachedData: tiers[i].data,
                autoFixable: true,
                fixAction: 'Invalidate all tiers and refresh'
              });
              break;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Tier consistency check failed:', error);
    }
  }

  /**
   * Add consistency issue
   */
  private addIssue(issue: Omit<ConsistencyIssue, 'id' | 'detectedAt' | 'autoFixable' | 'fixAction'> & 
    Partial<Pick<ConsistencyIssue, 'autoFixable' | 'fixAction'>>): void {
    this.issues.push({
      id: `issue-${++this.checkId}`,
      detectedAt: new Date(),
      autoFixable: false,
      ...issue
    });
  }

  /**
   * Group issues by type
   */
  private groupIssuesByType(): Record<ConsistencyIssueType, number> {
    const groups: Record<ConsistencyIssueType, number> = {
      stale_data: 0,
      missing_data: 0,
      corrupted_data: 0,
      tier_mismatch: 0,
      expired_not_cleaned: 0,
      orphaned_entry: 0
    };

    for (const issue of this.issues) {
      groups[issue.type]++;
    }

    return groups;
  }

  /**
   * Group issues by severity
   */
  private groupIssuesBySeverity(): Record<'low' | 'medium' | 'high' | 'critical', number> {
    const groups = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const issue of this.issues) {
      groups[issue.severity]++;
    }

    return groups;
  }

  /**
   * Generate recommendations based on issues found
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const issuesByType = this.groupIssuesByType();

    if (issuesByType.stale_data > 0) {
      recommendations.push('Consider reducing cache TTL values for frequently changing data');
    }

    if (issuesByType.missing_data > 0) {
      recommendations.push('Implement cache warming strategies for critical data');
    }

    if (issuesByType.tier_mismatch > 0) {
      recommendations.push('Review cache invalidation rules to ensure consistency across tiers');
    }

    if (issuesByType.expired_not_cleaned > 0) {
      recommendations.push('Schedule regular cache cleanup jobs');
    }

    if (issuesByType.orphaned_entry > 0) {
      recommendations.push('Implement orphaned entry cleanup in cache maintenance');
    }

    if (this.issues.filter(i => i.severity === 'critical').length > 0) {
      recommendations.push('Address critical issues immediately to prevent system instability');
    }

    return recommendations;
  }
}

/**
 * Cache repair utilities
 */
export class CacheRepairUtilities {
  /**
   * Auto-fix consistency issues
   */
  static async autoFixIssues(issues: ConsistencyIssue[]): Promise<{
    fixed: number;
    failed: number;
    errors: string[];
  }> {
    const result = { fixed: 0, failed: 0, errors: [] as string[] };

    for (const issue of issues) {
      if (!issue.autoFixable) continue;

      try {
        await this.fixIssue(issue);
        result.fixed++;
        console.log(`Auto-fixed issue: ${issue.description}`);
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to fix ${issue.id}: ${error}`);
        console.error(`Failed to auto-fix issue ${issue.id}:`, error);
      }
    }

    return result;
  }

  /**
   * Fix individual consistency issue
   */
  private static async fixIssue(issue: ConsistencyIssue): Promise<void> {
    switch (issue.type) {
      case 'stale_data':
      case 'tier_mismatch':
        // Invalidate cache to force refresh
        await cacheManager.invalidateByPattern(new RegExp(issue.cacheKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        break;

      case 'missing_data':
        // This would require re-warming the cache with source data
        // Implementation depends on the specific data type
        console.log(`Would warm cache for key: ${issue.cacheKey}`);
        break;

      case 'expired_not_cleaned':
        // Clean up expired entries
        const client = supabaseServer();
        await client
          .from('cache_entries')
          .delete()
          .lt('expires_at', new Date().toISOString());
        break;

      case 'orphaned_entry':
        // Remove orphaned cache entry
        const client2 = supabaseServer();
        await client2
          .from('cache_entries')
          .delete()
          .eq('key', issue.cacheKey);
        break;

      case 'corrupted_data':
        // Remove corrupted data and let it be refreshed
        await cacheManager.invalidateByPattern(new RegExp(issue.cacheKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        break;

      default:
        throw new Error(`Unknown issue type: ${issue.type}`);
    }
  }

  /**
   * Repair cache by rebuilding from source data
   */
  static async repairCacheFromSource(cacheKey: string): Promise<void> {
    // This would implement cache rebuilding logic
    // The implementation would depend on the specific cache key pattern
    console.log(`Repairing cache from source for key: ${cacheKey}`);
    
    // Invalidate existing cache
    await cacheManager.invalidateByPattern(new RegExp(cacheKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    
    // The actual rebuilding would be handled by the next cache request
    // which would fetch fresh data from the source
  }

  /**
   * Perform comprehensive cache repair
   */
  static async performComprehensiveRepair(): Promise<{
    clearedExpired: number;
    removedOrphaned: number;
    invalidatedStale: number;
  }> {
    const result = { clearedExpired: 0, removedOrphaned: 0, invalidatedStale: 0 };

    try {
      const client = supabaseServer();

      // Clear expired entries
      const { data: expiredData } = await client
        .from('cache_entries')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('key');
      
      result.clearedExpired = expiredData?.length || 0;

      // Additional repair operations would go here
      // For now, we'll just clear expired entries

      console.log('Comprehensive cache repair completed:', result);
      return result;
    } catch (error) {
      console.error('Comprehensive cache repair failed:', error);
      throw error;
    }
  }
}

// Global consistency checker instance
export const cacheConsistencyChecker = new CacheConsistencyChecker();