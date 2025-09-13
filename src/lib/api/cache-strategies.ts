/**
 * Intelligent cache strategies for different types of data
 * Implements data-specific caching policies and optimization
 */

import { CacheConfig, CACHE_PRESETS } from './cache-manager';
import { CacheKeyGenerator } from './cache-utils';

/**
 * Cache strategy types
 */
export type CacheStrategyType = 
  | 'static'           // Rarely changing data (settings, config)
  | 'dynamic'          // Frequently changing data (attempts, live data)
  | 'user-specific'    // User-dependent data (student info, attempts)
  | 'time-sensitive'   // Time-dependent data (exam schedules, deadlines)
  | 'computation-heavy' // Expensive calculations (analytics, reports)
  | 'external-api';    // External service responses

/**
 * Cache strategy configuration
 */
export interface CacheStrategy {
  type: CacheStrategyType;
  config: CacheConfig;
  keyGenerator: (params: any) => string;
  shouldCache: (data: any, context?: any) => boolean;
  invalidationTriggers: string[];
  warmupPriority: number;
}

/**
 * Predefined cache strategies for different data types
 */
export const CACHE_STRATEGIES: Record<string, CacheStrategy> = {
  // System configuration and settings
  SYSTEM_CONFIG: {
    type: 'static',
    config: {
      strategy: 'database',
      ttl: 3600, // 1 hour
      tags: ['system', 'config'],
      staleWhileRevalidate: 600 // 10 minutes
    },
    keyGenerator: (params: { type: string }) => 
      CacheKeyGenerator.configKey(params.type),
    shouldCache: (data) => data !== null && data !== undefined,
    invalidationTriggers: ['app_config', 'app_settings'],
    warmupPriority: 100
  },

  // Application settings
  APP_SETTINGS: {
    type: 'static',
    config: {
      strategy: 'edge',
      ttl: 1800, // 30 minutes
      tags: ['settings', 'config'],
      staleWhileRevalidate: 300 // 5 minutes
    },
    keyGenerator: (params: { key?: string }) => 
      CacheKeyGenerator.configKey(params.key || 'app-settings'),
    shouldCache: (data) => Array.isArray(data) || (data && Object.keys(data).length > 0),
    invalidationTriggers: ['app_config'],
    warmupPriority: 90
  },

  // Exam information and metadata
  EXAM_INFO: {
    type: 'time-sensitive',
    config: {
      strategy: 'edge',
      ttl: 900, // 15 minutes
      tags: ['exam', 'info'],
      staleWhileRevalidate: 180 // 3 minutes
    },
    keyGenerator: (params: { examId: string; includeQuestions?: boolean }) => 
      CacheKeyGenerator.examKey(params.examId, params.includeQuestions ? 'full' : 'info'),
    shouldCache: (data, context) => {
      // Don't cache if exam is currently active and has live attempts
      if (context?.hasActiveAttempts) return false;
      return data && data.id;
    },
    invalidationTriggers: ['exams', 'questions'],
    warmupPriority: 80
  },

  // Active exams list
  ACTIVE_EXAMS: {
    type: 'dynamic',
    config: {
      strategy: 'memory',
      ttl: 60, // 1 minute
      tags: ['exams', 'active'],
      staleWhileRevalidate: 30 // 30 seconds
    },
    keyGenerator: () => 'exams:active',
    shouldCache: (data) => Array.isArray(data),
    invalidationTriggers: ['exams', 'student_exam_attempts'],
    warmupPriority: 70
  },

  // Student information
  STUDENT_INFO: {
    type: 'user-specific',
    config: {
      strategy: 'memory',
      ttl: 600, // 10 minutes
      tags: ['student', 'user'],
      staleWhileRevalidate: 120 // 2 minutes
    },
    keyGenerator: (params: { studentCode: string; examId?: string }) => 
      CacheKeyGenerator.studentKey(
        params.studentCode, 
        params.examId ? `exam-${params.examId}` : 'info'
      ),
    shouldCache: (data) => data && (data.id || data.code),
    invalidationTriggers: ['students', 'student_exam_attempts'],
    warmupPriority: 60
  },

  // Exam attempt state
  ATTEMPT_STATE: {
    type: 'user-specific',
    config: {
      strategy: 'memory',
      ttl: 300, // 5 minutes
      tags: ['attempt', 'state'],
      staleWhileRevalidate: 60 // 1 minute
    },
    keyGenerator: (params: { attemptId: string; type?: string }) => 
      CacheKeyGenerator.attemptKey(params.attemptId, params.type || 'state'),
    shouldCache: (data, context) => {
      // Don't cache if attempt is currently being modified
      if (context?.isActive) return false;
      return data && data.id;
    },
    invalidationTriggers: ['exam_attempts', 'attempt_answers'],
    warmupPriority: 50
  },

  // Analytics and reports
  ANALYTICS_DATA: {
    type: 'computation-heavy',
    config: {
      strategy: 'database',
      ttl: 1800, // 30 minutes
      tags: ['analytics', 'reports'],
      staleWhileRevalidate: 600 // 10 minutes
    },
    keyGenerator: (params: { type: string; examId?: string; dateRange?: string }) => {
      const parts = ['analytics', params.type];
      if (params.examId) parts.push(`exam-${params.examId}`);
      if (params.dateRange) parts.push(params.dateRange);
      return parts.join(':');
    },
    shouldCache: (data) => data && (Array.isArray(data) || Object.keys(data).length > 0),
    invalidationTriggers: ['exam_attempts', 'exam_results'],
    warmupPriority: 30
  },

  // External API responses (WhatsApp, etc.)
  EXTERNAL_API: {
    type: 'external-api',
    config: {
      strategy: 'memory',
      ttl: 120, // 2 minutes
      tags: ['external', 'api'],
      staleWhileRevalidate: 30 // 30 seconds
    },
    keyGenerator: (params: { service: string; endpoint: string; params?: any }) => {
      const baseKey = `external:${params.service}:${params.endpoint}`;
      if (params.params) {
        const paramString = JSON.stringify(params.params);
        return `${baseKey}:${Buffer.from(paramString).toString('base64')}`;
      }
      return baseKey;
    },
    shouldCache: (data, context) => {
      // Don't cache error responses
      if (context?.isError) return false;
      return data !== null;
    },
    invalidationTriggers: [],
    warmupPriority: 10
  },

  // Code validation results
  CODE_VALIDATION: {
    type: 'user-specific',
    config: {
      strategy: 'memory',
      ttl: 180, // 3 minutes
      tags: ['validation', 'code'],
      staleWhileRevalidate: 60 // 1 minute
    },
    keyGenerator: (params: { code: string; examId: string }) => 
      `validation:${params.examId}:${params.code}`,
    shouldCache: (data) => data && typeof data.valid === 'boolean',
    invalidationTriggers: ['students', 'exams'],
    warmupPriority: 40
  },

  // IP and geographic data
  GEO_DATA: {
    type: 'static',
    config: {
      strategy: 'database',
      ttl: 7200, // 2 hours
      tags: ['geo', 'ip'],
      staleWhileRevalidate: 1800 // 30 minutes
    },
    keyGenerator: (params: { ip: string }) => `geo:${params.ip}`,
    shouldCache: (data) => data && (data.country || data.region),
    invalidationTriggers: [],
    warmupPriority: 20
  }
};

/**
 * Cache strategy selector based on data type and context
 */
export class CacheStrategySelector {
  /**
   * Select appropriate cache strategy based on data characteristics
   */
  static selectStrategy(
    dataType: string,
    context?: {
      isUserSpecific?: boolean;
      changeFrequency?: 'high' | 'medium' | 'low';
      computationCost?: 'high' | 'medium' | 'low';
      dataSize?: 'large' | 'medium' | 'small';
      isTimeDependent?: boolean;
    }
  ): CacheStrategy {
    // Check for predefined strategies first
    const predefined = CACHE_STRATEGIES[dataType.toUpperCase()];
    if (predefined) {
      return predefined;
    }

    // Fallback to context-based selection
    if (context?.isUserSpecific) {
      return CACHE_STRATEGIES.STUDENT_INFO;
    }

    if (context?.computationCost === 'high') {
      return CACHE_STRATEGIES.ANALYTICS_DATA;
    }

    if (context?.changeFrequency === 'high') {
      return CACHE_STRATEGIES.ACTIVE_EXAMS;
    }

    if (context?.isTimeDependent) {
      return CACHE_STRATEGIES.EXAM_INFO;
    }

    // Default to dynamic strategy
    return CACHE_STRATEGIES.ACTIVE_EXAMS;
  }

  /**
   * Get cache configuration for specific data type
   */
  static getConfig(dataType: string, context?: any): CacheConfig {
    const strategy = this.selectStrategy(dataType, context);
    return strategy.config;
  }

  /**
   * Generate cache key for specific data type
   */
  static generateKey(dataType: string, params: any): string {
    const strategy = this.selectStrategy(dataType);
    return strategy.keyGenerator(params);
  }

  /**
   * Check if data should be cached based on strategy rules
   */
  static shouldCache(dataType: string, data: any, context?: any): boolean {
    const strategy = this.selectStrategy(dataType);
    return strategy.shouldCache(data, context);
  }

  /**
   * Get invalidation triggers for data type
   */
  static getInvalidationTriggers(dataType: string): string[] {
    const strategy = this.selectStrategy(dataType);
    return strategy.invalidationTriggers;
  }
}

/**
 * Adaptive cache configuration based on system load and performance
 */
export class AdaptiveCacheConfig {
  private static performanceMetrics = {
    avgResponseTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cacheHitRate: 0
  };

  /**
   * Update performance metrics
   */
  static updateMetrics(metrics: {
    avgResponseTime?: number;
    errorRate?: number;
    memoryUsage?: number;
    cacheHitRate?: number;
  }): void {
    Object.assign(this.performanceMetrics, metrics);
  }

  /**
   * Get adaptive cache configuration based on current performance
   */
  static getAdaptiveConfig(baseStrategy: CacheStrategy): CacheConfig {
    const config = { ...baseStrategy.config };

    // Adjust TTL based on error rate
    if (this.performanceMetrics.errorRate > 0.05) { // 5% error rate
      config.ttl = Math.max(config.ttl * 0.5, 30); // Reduce TTL, minimum 30 seconds
    }

    // Adjust cache tier based on memory usage
    if (this.performanceMetrics.memoryUsage > 0.8) { // 80% memory usage
      if (config.strategy === 'database') {
        config.strategy = 'edge';
      } else if (config.strategy === 'edge') {
        config.strategy = 'memory';
      }
    }

    // Adjust stale-while-revalidate based on response time
    if (this.performanceMetrics.avgResponseTime > 1000) { // 1 second
      config.staleWhileRevalidate = Math.min(
        (config.staleWhileRevalidate || 0) * 2,
        config.ttl * 0.5
      );
    }

    // Increase TTL for high hit rate scenarios
    if (this.performanceMetrics.cacheHitRate > 0.9) { // 90% hit rate
      config.ttl = Math.min(config.ttl * 1.5, 7200); // Max 2 hours
    }

    return config;
  }

  /**
   * Get performance-optimized strategy
   */
  static getOptimizedStrategy(dataType: string, context?: any): CacheStrategy {
    const baseStrategy = CacheStrategySelector.selectStrategy(dataType, context);
    const adaptiveConfig = this.getAdaptiveConfig(baseStrategy);

    return {
      ...baseStrategy,
      config: adaptiveConfig
    };
  }
}

/**
 * Cache warming priority calculator
 */
export class CacheWarmupPriority {
  /**
   * Calculate warmup priority based on usage patterns
   */
  static calculatePriority(
    dataType: string,
    usageStats: {
      accessFrequency: number;
      avgResponseTime: number;
      cacheHitRate: number;
      lastAccessed: Date;
    }
  ): number {
    const strategy = CacheStrategySelector.selectStrategy(dataType);
    let priority = strategy.warmupPriority;

    // Boost priority for frequently accessed data
    if (usageStats.accessFrequency > 100) { // More than 100 accesses
      priority += 20;
    }

    // Boost priority for slow responses
    if (usageStats.avgResponseTime > 500) { // More than 500ms
      priority += 15;
    }

    // Reduce priority for high hit rate (already well cached)
    if (usageStats.cacheHitRate > 0.8) {
      priority -= 10;
    }

    // Reduce priority for stale data
    const hoursSinceAccess = (Date.now() - usageStats.lastAccessed.getTime()) / (1000 * 60 * 60);
    if (hoursSinceAccess > 24) {
      priority -= 30;
    }

    return Math.max(priority, 0);
  }

  /**
   * Get prioritized list of data types for warming
   */
  static getPrioritizedWarmupList(
    usageData: Record<string, {
      accessFrequency: number;
      avgResponseTime: number;
      cacheHitRate: number;
      lastAccessed: Date;
    }>
  ): Array<{ dataType: string; priority: number }> {
    return Object.entries(usageData)
      .map(([dataType, stats]) => ({
        dataType,
        priority: this.calculatePriority(dataType, stats)
      }))
      .sort((a, b) => b.priority - a.priority);
  }
}

export { CacheStrategy, CacheStrategyType };