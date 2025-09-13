/**
 * Intelligent cache warming utilities
 * Implements smart cache warming based on usage patterns and predictions
 */

import { supabaseServer } from '@/lib/supabase/server';
import { cacheManager, CacheConfig } from './cache-manager';
import { CacheStrategySelector, CACHE_STRATEGIES } from './cache-strategies';
import { CacheAnalyticsCollector } from './cache-analytics';
import { CacheKeyGenerator } from './cache-utils';

/**
 * Cache warming job interface
 */
export interface CacheWarmingJob {
  id: string;
  name: string;
  priority: number;
  dataType: string;
  keyPattern: string;
  config: CacheConfig;
  dataFetcher: () => Promise<any>;
  condition?: () => Promise<boolean>;
  dependencies?: string[];
  estimatedDuration: number;
  lastRun?: Date;
  nextRun?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * Cache warming scheduler
 */
export class CacheWarmingScheduler {
  private jobs: Map<string, CacheWarmingJob> = new Map();
  private runningJobs: Set<string> = new Set();
  private jobQueue: string[] = [];
  private isRunning = false;

  /**
   * Register a cache warming job
   */
  registerJob(job: CacheWarmingJob): void {
    this.jobs.set(job.id, job);
    this.scheduleJob(job.id);
  }

  /**
   * Schedule a job for execution
   */
  private scheduleJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Check if job should run based on conditions
    if (job.condition) {
      job.condition().then(shouldRun => {
        if (shouldRun && !this.jobQueue.includes(jobId)) {
          this.jobQueue.push(jobId);
          this.sortJobQueue();
        }
      });
    } else {
      if (!this.jobQueue.includes(jobId)) {
        this.jobQueue.push(jobId);
        this.sortJobQueue();
      }
    }
  }

  /**
   * Sort job queue by priority and dependencies
   */
  private sortJobQueue(): void {
    this.jobQueue.sort((a, b) => {
      const jobA = this.jobs.get(a)!;
      const jobB = this.jobs.get(b)!;
      
      // Check dependencies first
      if (jobA.dependencies?.includes(b)) return 1;
      if (jobB.dependencies?.includes(a)) return -1;
      
      // Then sort by priority
      return jobB.priority - jobA.priority;
    });
  }

  /**
   * Execute cache warming jobs
   */
  async executeJobs(maxConcurrent: number = 3): Promise<{
    completed: number;
    failed: number;
    errors: string[];
  }> {
    if (this.isRunning) {
      throw new Error('Cache warming is already running');
    }

    this.isRunning = true;
    const results = {
      completed: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      while (this.jobQueue.length > 0 || this.runningJobs.size > 0) {
        // Start new jobs up to the concurrent limit
        while (this.jobQueue.length > 0 && this.runningJobs.size < maxConcurrent) {
          const jobId = this.jobQueue.shift()!;
          const job = this.jobs.get(jobId);
          
          if (!job) continue;

          // Check dependencies
          if (job.dependencies && !this.areDependenciesMet(job.dependencies)) {
            // Re-queue the job
            this.jobQueue.push(jobId);
            continue;
          }

          this.runningJobs.add(jobId);
          this.executeJob(job)
            .then(() => {
              results.completed++;
              job.status = 'completed';
              job.lastRun = new Date();
            })
            .catch(error => {
              results.failed++;
              results.errors.push(`${job.name}: ${error.message}`);
              job.status = 'failed';
            })
            .finally(() => {
              this.runningJobs.delete(jobId);
            });
        }

        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Check if job dependencies are met
   */
  private areDependenciesMet(dependencies: string[]): boolean {
    return dependencies.every(depId => {
      const dep = this.jobs.get(depId);
      return dep?.status === 'completed';
    });
  }

  /**
   * Execute a single cache warming job
   */
  private async executeJob(job: CacheWarmingJob): Promise<void> {
    console.log(`Starting cache warming job: ${job.name}`);
    job.status = 'running';

    const startTime = Date.now();
    
    try {
      const data = await job.dataFetcher();
      
      if (data !== null && data !== undefined) {
        const cacheKey = job.keyPattern;
        await cacheManager.set(cacheKey, data, job.config);
        
        // Record analytics
        CacheAnalyticsCollector.recordOperation(
          cacheKey,
          'hit', // Warming counts as a hit for analytics
          Date.now() - startTime,
          job.dataType,
          JSON.stringify(data).length,
          job.config.ttl,
          job.config.tags
        );
        
        console.log(`Cache warming completed for: ${job.name}`);
      } else {
        console.warn(`Cache warming returned null data for: ${job.name}`);
      }
    } catch (error) {
      console.error(`Cache warming failed for ${job.name}:`, error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): CacheWarmingJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): CacheWarmingJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Remove a job
   */
  removeJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Clear all jobs
   */
  clearJobs(): void {
    this.jobs.clear();
    this.jobQueue = [];
    this.runningJobs.clear();
  }
}

/**
 * Intelligent cache warming based on usage patterns
 */
export class IntelligentCacheWarming {
  private scheduler = new CacheWarmingScheduler();

  /**
   * Initialize intelligent cache warming
   */
  async initialize(): Promise<void> {
    await this.registerCoreJobs();
    await this.registerPredictiveJobs();
  }

  /**
   * Register core cache warming jobs
   */
  private async registerCoreJobs(): Promise<void> {
    // System configuration
    this.scheduler.registerJob({
      id: 'system-config',
      name: 'System Configuration',
      priority: 100,
      dataType: 'SYSTEM_CONFIG',
      keyPattern: CacheKeyGenerator.configKey('system'),
      config: CACHE_STRATEGIES.SYSTEM_CONFIG.config,
      dataFetcher: async () => {
        const client = supabaseServer();
        const { data } = await client
          .from('app_config')
          .select('*')
          .maybeSingle();
        return data;
      },
      estimatedDuration: 500
    });

    // App settings
    this.scheduler.registerJob({
      id: 'app-settings',
      name: 'Application Settings',
      priority: 90,
      dataType: 'APP_SETTINGS',
      keyPattern: CacheKeyGenerator.configKey('app-settings'),
      config: CACHE_STRATEGIES.APP_SETTINGS.config,
      dataFetcher: async () => {
        const client = supabaseServer();
        const { data } = await client
          .from('app_config')
          .select('key, value')
          .in('key', ['system_mode', 'system_disabled_message', 'whatsapp_enabled']);
        return data;
      },
      dependencies: ['system-config'],
      estimatedDuration: 300
    });

    // Active exams
    this.scheduler.registerJob({
      id: 'active-exams',
      name: 'Active Exams List',
      priority: 80,
      dataType: 'ACTIVE_EXAMS',
      keyPattern: 'exams:active',
      config: CACHE_STRATEGIES.ACTIVE_EXAMS.config,
      dataFetcher: async () => {
        const client = supabaseServer();
        const { data } = await client
          .from('exams')
          .select('id, title, status, start_time, end_time, access_type, created_at')
          .eq('status', 'published')
          .order('start_time', { ascending: true })
          .limit(20);
        return data;
      },
      condition: async () => {
        // Only warm if there are published exams
        const client = supabaseServer();
        const { count } = await client
          .from('exams')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published');
        return (count || 0) > 0;
      },
      estimatedDuration: 800
    });
  }

  /**
   * Register predictive cache warming jobs based on usage patterns
   */
  private async registerPredictiveJobs(): Promise<void> {
    // Get usage analytics to predict what to warm
    const analytics = CacheAnalyticsCollector.getAnalytics();
    
    // Warm frequently accessed exams
    for (const performer of analytics.topPerformers.slice(0, 5)) {
      if (performer.dataType === 'EXAM_INFO') {
        const examId = this.extractExamIdFromKey(performer.key);
        if (examId) {
          this.scheduler.registerJob({
            id: `exam-${examId}`,
            name: `Exam ${examId} Details`,
            priority: 70,
            dataType: 'EXAM_INFO',
            keyPattern: CacheKeyGenerator.examKey(examId, 'full'),
            config: CACHE_STRATEGIES.EXAM_INFO.config,
            dataFetcher: async () => {
              const client = supabaseServer();
              const { data } = await client
                .from('exams')
                .select(`
                  *,
                  questions (
                    id, type, question_text, options, correct_answer, points
                  )
                `)
                .eq('id', examId)
                .single();
              return data;
            },
            dependencies: ['active-exams'],
            estimatedDuration: 1200
          });
        }
      }
    }

    // Warm analytics data for active exams
    const activeExamsData = await this.getActiveExamsForWarming();
    for (const exam of activeExamsData.slice(0, 3)) {
      this.scheduler.registerJob({
        id: `analytics-${exam.id}`,
        name: `Analytics for Exam ${exam.title}`,
        priority: 40,
        dataType: 'ANALYTICS_DATA',
        keyPattern: `analytics:exam-summary:${exam.id}`,
        config: CACHE_STRATEGIES.ANALYTICS_DATA.config,
        dataFetcher: async () => {
          const client = supabaseServer();
          const { data } = await client
            .from('student_exam_summary')
            .select('*')
            .eq('exam_id', exam.id);
          return data;
        },
        dependencies: [`exam-${exam.id}`],
        estimatedDuration: 2000
      });
    }
  }

  /**
   * Get active exams for warming
   */
  private async getActiveExamsForWarming(): Promise<Array<{ id: string; title: string }>> {
    const client = supabaseServer();
    const { data } = await client
      .from('exams')
      .select('id, title')
      .eq('status', 'published')
      .limit(5);
    
    return data || [];
  }

  /**
   * Extract exam ID from cache key
   */
  private extractExamIdFromKey(key: string): string | null {
    const match = key.match(/exam:([^:]+)/);
    return match ? match[1] : null;
  }

  /**
   * Execute intelligent cache warming
   */
  async executeWarming(options: {
    maxConcurrent?: number;
    maxDuration?: number;
    priority?: number;
  } = {}): Promise<{
    completed: number;
    failed: number;
    duration: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const maxDuration = options.maxDuration || 30000; // 30 seconds default
    
    console.log('Starting intelligent cache warming...');
    
    // Set a timeout to prevent long-running warming
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Cache warming timeout')), maxDuration);
    });

    try {
      const results = await Promise.race([
        this.scheduler.executeJobs(options.maxConcurrent),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      
      console.log(`Cache warming completed in ${duration}ms: ${results.completed} success, ${results.failed} failed`);
      
      return {
        ...results,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof Error && error.message === 'Cache warming timeout') {
        console.warn(`Cache warming timed out after ${duration}ms`);
        return {
          completed: 0,
          failed: 1,
          duration,
          errors: ['Cache warming timed out']
        };
      }
      
      throw error;
    }
  }

  /**
   * Schedule periodic cache warming
   */
  schedulePeriodicWarming(intervalMs: number = 300000): void { // 5 minutes default
    setInterval(async () => {
      try {
        await this.executeWarming({
          maxConcurrent: 2,
          maxDuration: 15000 // 15 seconds for periodic warming
        });
      } catch (error) {
        console.error('Periodic cache warming failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Get warming status
   */
  getWarmingStatus(): {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    pendingJobs: number;
    runningJobs: number;
  } {
    const jobs = this.scheduler.getAllJobs();
    
    return {
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      pendingJobs: jobs.filter(j => j.status === 'pending').length,
      runningJobs: jobs.filter(j => j.status === 'running').length
    };
  }
}

// Global intelligent cache warming instance
export const intelligentCacheWarming = new IntelligentCacheWarming();

/**
 * Cache warming utilities for specific scenarios
 */
export class CacheWarmingUtils {
  /**
   * Warm cache for upcoming exam
   */
  static async warmExamCache(examId: string): Promise<void> {
    const config = CacheStrategySelector.getConfig('EXAM_INFO');
    
    // Warm exam details
    const examKey = CacheKeyGenerator.examKey(examId, 'full');
    const examData = await CacheWarmingUtils.fetchExamData(examId);
    await cacheManager.set(examKey, examData, config);

    // Warm exam questions
    const questionsKey = CacheKeyGenerator.examKey(examId, 'questions');
    const questionsData = await CacheWarmingUtils.fetchExamQuestions(examId);
    await cacheManager.set(questionsKey, questionsData, config);

    console.log(`Cache warmed for exam: ${examId}`);
  }

  /**
   * Warm cache for student session
   */
  static async warmStudentCache(studentCode: string, examId?: string): Promise<void> {
    const config = CacheStrategySelector.getConfig('STUDENT_INFO');
    
    // Warm student info
    const studentKey = CacheKeyGenerator.studentKey(studentCode);
    const studentData = await CacheWarmingUtils.fetchStudentData(studentCode);
    await cacheManager.set(studentKey, studentData, config);

    // Warm exam-specific student data if exam provided
    if (examId) {
      const examStudentKey = CacheKeyGenerator.studentKey(studentCode, `exam-${examId}`);
      const examStudentData = await CacheWarmingUtils.fetchStudentExamData(studentCode, examId);
      await cacheManager.set(examStudentKey, examStudentData, config);
    }

    console.log(`Cache warmed for student: ${studentCode}`);
  }

  /**
   * Fetch exam data
   */
  private static async fetchExamData(examId: string): Promise<any> {
    const client = supabaseServer();
    const { data } = await client
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();
    return data;
  }

  /**
   * Fetch exam questions
   */
  private static async fetchExamQuestions(examId: string): Promise<any> {
    const client = supabaseServer();
    const { data } = await client
      .from('questions')
      .select('*')
      .eq('exam_id', examId)
      .order('order_index');
    return data;
  }

  /**
   * Fetch student data
   */
  private static async fetchStudentData(studentCode: string): Promise<any> {
    const client = supabaseServer();
    const { data } = await client
      .from('students')
      .select('*')
      .eq('code', studentCode)
      .single();
    return data;
  }

  /**
   * Fetch student exam data
   */
  private static async fetchStudentExamData(studentCode: string, examId: string): Promise<any> {
    const client = supabaseServer();
    const { data } = await client
      .from('student_exam_attempts')
      .select('*')
      .eq('student_code', studentCode)
      .eq('exam_id', examId)
      .maybeSingle();
    return data;
  }
}