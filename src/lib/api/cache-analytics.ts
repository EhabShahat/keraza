/**
 * Cache analytics and hit rate monitoring
 * Provides detailed insights into cache performance and usage patterns
 */

import { supabaseServer } from '@/lib/supabase/server';

/**
 * Cache analytics data structure
 */
export interface CacheAnalytics {
  // Basic metrics
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  
  // Performance metrics
  avgResponseTime: number;
  avgCacheResponseTime: number;
  avgMissResponseTime: number;
  
  // Size and efficiency metrics
  totalCacheSize: number;
  averageEntrySize: number;
  evictionCount: number;
  
  // Time-based metrics
  timeRange: {
    start: Date;
    end: Date;
  };
  
  // Breakdown by cache tier
  tierBreakdown: {
    memory: CacheTierMetrics;
    edge: CacheTierMetrics;
    database: CacheTierMetrics;
  };
  
  // Breakdown by data type
  dataTypeBreakdown: Record<string, CacheDataTypeMetrics>;
  
  // Top performing and underperforming entries
  topPerformers: CacheEntryMetrics[];
  underPerformers: CacheEntryMetrics[];
}

/**
 * Cache tier metrics
 */
export interface CacheTierMetrics {
  requests: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  size: number;
  evictions: number;
}

/**
 * Cache data type metrics
 */
export interface CacheDataTypeMetrics {
  requests: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  totalSize: number;
  entryCount: number;
  avgEntrySize: number;
}

/**
 * Individual cache entry metrics
 */
export interface CacheEntryMetrics {
  key: string;
  dataType: string;
  requests: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  size: number;
  lastAccessed: Date;
  createdAt: Date;
  ttl: number;
  tags: string[];
}

/**
 * Cache analytics collector
 */
export class CacheAnalyticsCollector {
  private static metrics: Map<string, CacheEntryMetrics> = new Map();
  private static globalMetrics = {
    totalRequests: 0,
    totalHits: 0,
    totalMisses: 0,
    totalResponseTime: 0,
    totalCacheResponseTime: 0,
    totalMissResponseTime: 0,
    startTime: new Date()
  };

  /**
   * Record cache operation
   */
  static recordOperation(
    key: string,
    operation: 'hit' | 'miss',
    responseTime: number,
    dataType: string,
    size: number = 0,
    ttl: number = 0,
    tags: string[] = []
  ): void {
    // Update global metrics
    this.globalMetrics.totalRequests++;
    this.globalMetrics.totalResponseTime += responseTime;

    if (operation === 'hit') {
      this.globalMetrics.totalHits++;
      this.globalMetrics.totalCacheResponseTime += responseTime;
    } else {
      this.globalMetrics.totalMisses++;
      this.globalMetrics.totalMissResponseTime += responseTime;
    }

    // Update entry-specific metrics
    let entryMetrics = this.metrics.get(key);
    if (!entryMetrics) {
      entryMetrics = {
        key,
        dataType,
        requests: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        avgResponseTime: 0,
        size,
        lastAccessed: new Date(),
        createdAt: new Date(),
        ttl,
        tags
      };
      this.metrics.set(key, entryMetrics);
    }

    entryMetrics.requests++;
    entryMetrics.lastAccessed = new Date();

    if (operation === 'hit') {
      entryMetrics.hits++;
    } else {
      entryMetrics.misses++;
    }

    // Recalculate derived metrics
    entryMetrics.hitRate = entryMetrics.hits / entryMetrics.requests;
    entryMetrics.avgResponseTime = 
      (entryMetrics.avgResponseTime * (entryMetrics.requests - 1) + responseTime) / entryMetrics.requests;
  }

  /**
   * Record cache eviction
   */
  static recordEviction(key: string): void {
    const entryMetrics = this.metrics.get(key);
    if (entryMetrics) {
      // Mark as evicted but keep metrics for analysis
      entryMetrics.lastAccessed = new Date();
    }
  }

  /**
   * Get comprehensive analytics
   */
  static getAnalytics(timeRange?: { start: Date; end: Date }): CacheAnalytics {
    const now = new Date();
    const range = timeRange || {
      start: this.globalMetrics.startTime,
      end: now
    };

    // Filter metrics by time range if specified
    const filteredMetrics = Array.from(this.metrics.values()).filter(metric => 
      metric.lastAccessed >= range.start && metric.lastAccessed <= range.end
    );

    // Calculate global metrics
    const totalRequests = this.globalMetrics.totalRequests;
    const totalHits = this.globalMetrics.totalHits;
    const totalMisses = this.globalMetrics.totalMisses;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    // Calculate average response times
    const avgResponseTime = totalRequests > 0 
      ? this.globalMetrics.totalResponseTime / totalRequests : 0;
    const avgCacheResponseTime = totalHits > 0 
      ? this.globalMetrics.totalCacheResponseTime / totalHits : 0;
    const avgMissResponseTime = totalMisses > 0 
      ? this.globalMetrics.totalMissResponseTime / totalMisses : 0;

    // Calculate size metrics
    const totalCacheSize = filteredMetrics.reduce((sum, metric) => sum + metric.size, 0);
    const averageEntrySize = filteredMetrics.length > 0 
      ? totalCacheSize / filteredMetrics.length : 0;

    // Group by data type
    const dataTypeBreakdown = this.calculateDataTypeBreakdown(filteredMetrics);

    // Calculate tier breakdown (simulated for now)
    const tierBreakdown = this.calculateTierBreakdown(filteredMetrics);

    // Find top and underperformers
    const sortedByHitRate = [...filteredMetrics].sort((a, b) => b.hitRate - a.hitRate);
    const topPerformers = sortedByHitRate.slice(0, 10);
    const underPerformers = sortedByHitRate.slice(-10).reverse();

    return {
      totalRequests,
      cacheHits: totalHits,
      cacheMisses: totalMisses,
      hitRate,
      avgResponseTime,
      avgCacheResponseTime,
      avgMissResponseTime,
      totalCacheSize,
      averageEntrySize,
      evictionCount: 0, // Would need to track separately
      timeRange: range,
      tierBreakdown,
      dataTypeBreakdown,
      topPerformers,
      underPerformers
    };
  }

  /**
   * Calculate data type breakdown
   */
  private static calculateDataTypeBreakdown(
    metrics: CacheEntryMetrics[]
  ): Record<string, CacheDataTypeMetrics> {
    const breakdown: Record<string, CacheDataTypeMetrics> = {};

    for (const metric of metrics) {
      if (!breakdown[metric.dataType]) {
        breakdown[metric.dataType] = {
          requests: 0,
          hits: 0,
          misses: 0,
          hitRate: 0,
          avgResponseTime: 0,
          totalSize: 0,
          entryCount: 0,
          avgEntrySize: 0
        };
      }

      const typeMetric = breakdown[metric.dataType];
      typeMetric.requests += metric.requests;
      typeMetric.hits += metric.hits;
      typeMetric.misses += metric.misses;
      typeMetric.totalSize += metric.size;
      typeMetric.entryCount++;
    }

    // Calculate derived metrics
    for (const typeMetric of Object.values(breakdown)) {
      typeMetric.hitRate = typeMetric.requests > 0 
        ? typeMetric.hits / typeMetric.requests : 0;
      typeMetric.avgEntrySize = typeMetric.entryCount > 0 
        ? typeMetric.totalSize / typeMetric.entryCount : 0;
    }

    return breakdown;
  }

  /**
   * Calculate tier breakdown (simulated)
   */
  private static calculateTierBreakdown(
    metrics: CacheEntryMetrics[]
  ): { memory: CacheTierMetrics; edge: CacheTierMetrics; database: CacheTierMetrics } {
    // This would be implemented based on actual cache tier usage
    // For now, we'll simulate based on data patterns
    
    const memory: CacheTierMetrics = {
      requests: 0, hits: 0, misses: 0, hitRate: 0, 
      avgResponseTime: 0, size: 0, evictions: 0
    };
    
    const edge: CacheTierMetrics = {
      requests: 0, hits: 0, misses: 0, hitRate: 0, 
      avgResponseTime: 0, size: 0, evictions: 0
    };
    
    const database: CacheTierMetrics = {
      requests: 0, hits: 0, misses: 0, hitRate: 0, 
      avgResponseTime: 0, size: 0, evictions: 0
    };

    // Simulate distribution based on data types
    for (const metric of metrics) {
      if (metric.dataType.includes('attempt') || metric.dataType.includes('student')) {
        // User-specific data typically goes to memory
        memory.requests += metric.requests;
        memory.hits += metric.hits;
        memory.misses += metric.misses;
        memory.size += metric.size;
      } else if (metric.dataType.includes('exam') || metric.dataType.includes('config')) {
        // Shared data typically goes to edge
        edge.requests += metric.requests;
        edge.hits += metric.hits;
        edge.misses += metric.misses;
        edge.size += metric.size;
      } else {
        // Analytics and heavy computation goes to database
        database.requests += metric.requests;
        database.hits += metric.hits;
        database.misses += metric.misses;
        database.size += metric.size;
      }
    }

    // Calculate hit rates
    memory.hitRate = memory.requests > 0 ? memory.hits / memory.requests : 0;
    edge.hitRate = edge.requests > 0 ? edge.hits / edge.requests : 0;
    database.hitRate = database.requests > 0 ? database.hits / database.requests : 0;

    return { memory, edge, database };
  }

  /**
   * Get real-time cache statistics
   */
  static getRealTimeStats(): {
    currentHitRate: number;
    requestsPerMinute: number;
    avgResponseTime: number;
    activeEntries: number;
    totalSize: number;
  } {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    
    const recentMetrics = Array.from(this.metrics.values()).filter(
      metric => metric.lastAccessed >= oneMinuteAgo
    );

    const recentRequests = recentMetrics.reduce((sum, metric) => sum + metric.requests, 0);
    const recentHits = recentMetrics.reduce((sum, metric) => sum + metric.hits, 0);
    
    return {
      currentHitRate: recentRequests > 0 ? recentHits / recentRequests : 0,
      requestsPerMinute: recentRequests,
      avgResponseTime: this.globalMetrics.totalRequests > 0 
        ? this.globalMetrics.totalResponseTime / this.globalMetrics.totalRequests : 0,
      activeEntries: this.metrics.size,
      totalSize: Array.from(this.metrics.values()).reduce((sum, metric) => sum + metric.size, 0)
    };
  }

  /**
   * Reset analytics data
   */
  static reset(): void {
    this.metrics.clear();
    this.globalMetrics = {
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      totalResponseTime: 0,
      totalCacheResponseTime: 0,
      totalMissResponseTime: 0,
      startTime: new Date()
    };
  }

  /**
   * Export analytics data for external analysis
   */
  static exportData(): {
    globalMetrics: typeof CacheAnalyticsCollector.globalMetrics;
    entryMetrics: CacheEntryMetrics[];
  } {
    return {
      globalMetrics: { ...this.globalMetrics },
      entryMetrics: Array.from(this.metrics.values())
    };
  }

  /**
   * Generate cache optimization recommendations
   */
  static getOptimizationRecommendations(): Array<{
    type: 'warning' | 'suggestion' | 'info';
    message: string;
    action?: string;
  }> {
    const recommendations: Array<{
      type: 'warning' | 'suggestion' | 'info';
      message: string;
      action?: string;
    }> = [];

    const analytics = this.getAnalytics();

    // Low hit rate warning
    if (analytics.hitRate < 0.5) {
      recommendations.push({
        type: 'warning',
        message: `Cache hit rate is low (${(analytics.hitRate * 100).toFixed(1)}%)`,
        action: 'Consider increasing TTL values or improving cache warming strategies'
      });
    }

    // High miss response time
    if (analytics.avgMissResponseTime > analytics.avgCacheResponseTime * 3) {
      recommendations.push({
        type: 'suggestion',
        message: 'Cache misses are significantly slower than hits',
        action: 'Consider implementing cache warming for frequently accessed data'
      });
    }

    // Underperforming data types
    for (const [dataType, metrics] of Object.entries(analytics.dataTypeBreakdown)) {
      if (metrics.hitRate < 0.3 && metrics.requests > 10) {
        recommendations.push({
          type: 'suggestion',
          message: `Data type "${dataType}" has low hit rate (${(metrics.hitRate * 100).toFixed(1)}%)`,
          action: 'Review caching strategy for this data type'
        });
      }
    }

    // Memory tier overuse
    if (analytics.tierBreakdown.memory.requests > analytics.totalRequests * 0.7) {
      recommendations.push({
        type: 'info',
        message: 'Memory tier is handling most requests',
        action: 'Consider moving some data to edge or database tiers for better distribution'
      });
    }

    return recommendations;
  }
}

/**
 * Cache performance monitor with alerting
 */
export class CachePerformanceMonitor {
  private static thresholds = {
    minHitRate: 0.6,
    maxAvgResponseTime: 500,
    maxMemoryUsage: 0.8
  };

  private static alerts: Array<{
    timestamp: Date;
    type: 'hit_rate' | 'response_time' | 'memory_usage';
    message: string;
    severity: 'low' | 'medium' | 'high';
  }> = [];

  /**
   * Check performance and generate alerts
   */
  static checkPerformance(): void {
    const stats = CacheAnalyticsCollector.getRealTimeStats();
    const now = new Date();

    // Check hit rate
    if (stats.currentHitRate < this.thresholds.minHitRate) {
      this.alerts.push({
        timestamp: now,
        type: 'hit_rate',
        message: `Cache hit rate dropped to ${(stats.currentHitRate * 100).toFixed(1)}%`,
        severity: stats.currentHitRate < 0.3 ? 'high' : 'medium'
      });
    }

    // Check response time
    if (stats.avgResponseTime > this.thresholds.maxAvgResponseTime) {
      this.alerts.push({
        timestamp: now,
        type: 'response_time',
        message: `Average response time increased to ${stats.avgResponseTime.toFixed(0)}ms`,
        severity: stats.avgResponseTime > 1000 ? 'high' : 'medium'
      });
    }

    // Cleanup old alerts (keep last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Get recent alerts
   */
  static getAlerts(since?: Date): typeof CachePerformanceMonitor.alerts {
    if (since) {
      return this.alerts.filter(alert => alert.timestamp >= since);
    }
    return [...this.alerts];
  }

  /**
   * Update performance thresholds
   */
  static updateThresholds(thresholds: Partial<typeof CachePerformanceMonitor.thresholds>): void {
    Object.assign(this.thresholds, thresholds);
  }
}

// Start performance monitoring
setInterval(() => {
  CachePerformanceMonitor.checkPerformance();
}, 60000); // Check every minute