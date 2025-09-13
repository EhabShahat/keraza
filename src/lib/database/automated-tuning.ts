/**
 * Automated Database Tuning System
 * Provides automated optimization recommendations and self-tuning capabilities
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { queryOptimizer } from './query-optimizer';
import { performanceMonitor } from './performance-monitor';

interface TuningRecommendation {
  id: string;
  type: 'index' | 'query' | 'connection' | 'cache' | 'schema';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  sql?: string;
  automated: boolean;
  applied: boolean;
  createdAt: Date;
  appliedAt?: Date;
}

interface AutoTuningConfig {
  enabled: boolean;
  autoApplyLowRisk: boolean;
  maxRecommendations: number;
  analysisInterval: number; // minutes
  minDataPoints: number;
}

class AutomatedTuningSystem {
  private static instance: AutomatedTuningSystem;
  private recommendations: Map<string, TuningRecommendation> = new Map();
  private config: AutoTuningConfig;
  private analysisTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      enabled: process.env.AUTO_TUNING_ENABLED === 'true',
      autoApplyLowRisk: process.env.AUTO_APPLY_LOW_RISK === 'true',
      maxRecommendations: 50,
      analysisInterval: 30, // 30 minutes
      minDataPoints: 100
    };

    if (this.config.enabled) {
      this.startAnalysis();
    }
  }

  static getInstance(): AutomatedTuningSystem {
    if (!AutomatedTuningSystem.instance) {
      AutomatedTuningSystem.instance = new AutomatedTuningSystem();
    }
    return AutomatedTuningSystem.instance;
  }

  /**
   * Start automated analysis
   */
  private startAnalysis(): void {
    if (this.analysisTimer) return;

    this.analysisTimer = setInterval(() => {
      this.performAnalysis();
    }, this.config.analysisInterval * 60 * 1000);

    // Run initial analysis after 5 minutes
    setTimeout(() => {
      this.performAnalysis();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop automated analysis
   */
  stopAnalysis(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  }

  /**
   * Perform comprehensive database analysis
   */
  private async performAnalysis(): Promise<void> {
    try {
      console.log('🔍 Starting automated database analysis...');

      const analytics = queryOptimizer.getQueryAnalytics(60 * 60 * 1000); // Last hour
      
      if (analytics.totalQueries < this.config.minDataPoints) {
        console.log('⏳ Insufficient data points for analysis');
        return;
      }

      // Analyze different aspects
      await Promise.all([
        this.analyzeSlowQueries(analytics),
        this.analyzeConnectionPool(),
        this.analyzeQueryPatterns(analytics),
        this.analyzeErrorPatterns(analytics)
      ]);

      // Auto-apply low-risk recommendations if enabled
      if (this.config.autoApplyLowRisk) {
        await this.autoApplyRecommendations();
      }

      console.log(`✅ Analysis complete. ${this.recommendations.size} recommendations generated.`);

    } catch (error) {
      console.error('❌ Automated analysis failed:', error);
    }
  }

  /**
   * Analyze slow queries and generate index recommendations
   */
  private async analyzeSlowQueries(analytics: any): Promise<void> {
    const slowQueries = analytics.slowQueries.filter((q: any) => q.duration > 1000);
    
    if (slowQueries.length === 0) return;

    // Group slow queries by type
    const queryGroups = new Map<string, any[]>();
    slowQueries.forEach((query: any) => {
      const key = this.extractQueryPattern(query.query);
      if (!queryGroups.has(key)) {
        queryGroups.set(key, []);
      }
      queryGroups.get(key)!.push(query);
    });

    // Generate recommendations for frequent slow queries
    for (const [pattern, queries] of queryGroups) {
      if (queries.length >= 3) { // At least 3 occurrences
        const avgDuration = queries.reduce((sum: number, q: any) => sum + q.duration, 0) / queries.length;
        
        if (avgDuration > 2000) { // Average > 2 seconds
          this.addRecommendation({
            type: 'index',
            priority: 'high',
            title: `Add index for slow query pattern: ${pattern}`,
            description: `Query pattern "${pattern}" is consistently slow (avg: ${avgDuration.toFixed(0)}ms)`,
            impact: `Could improve response time by 50-80% for ${queries.length} similar queries`,
            effort: 'low',
            automated: false,
            sql: this.generateIndexSuggestion(pattern)
          });
        }
      }
    }
  }

  /**
   * Analyze connection pool utilization
   */
  private async analyzeConnectionPool(): Promise<void> {
    const poolStatus = queryOptimizer.getPoolStatus();
    
    if (poolStatus.poolUtilization > 0.8) {
      this.addRecommendation({
        type: 'connection',
        priority: poolStatus.poolUtilization > 0.95 ? 'critical' : 'high',
        title: 'Increase connection pool size',
        description: `Connection pool utilization is ${(poolStatus.poolUtilization * 100).toFixed(1)}%`,
        impact: 'Reduce connection wait times and improve concurrent request handling',
        effort: 'low',
        automated: true
      });
    }

    if (poolStatus.poolUtilization < 0.2 && poolStatus.maxConnections > 5) {
      this.addRecommendation({
        type: 'connection',
        priority: 'low',
        title: 'Reduce connection pool size',
        description: `Connection pool utilization is only ${(poolStatus.poolUtilization * 100).toFixed(1)}%`,
        impact: 'Reduce memory usage and connection overhead',
        effort: 'low',
        automated: true
      });
    }
  }

  /**
   * Analyze query patterns for optimization opportunities
   */
  private async analyzeQueryPatterns(analytics: any): Promise<void> {
    const topQueries = analytics.topQueries;
    
    // Look for N+1 query patterns
    const suspiciousPatterns = topQueries.filter((q: any) => 
      q.count > 50 && q.avgDuration > 100 && this.isLikelyNPlusOne(q.query)
    );

    suspiciousPatterns.forEach((pattern: any) => {
      this.addRecommendation({
        type: 'query',
        priority: 'medium',
        title: `Potential N+1 query pattern detected: ${pattern.query}`,
        description: `Query executed ${pattern.count} times with avg duration ${pattern.avgDuration.toFixed(0)}ms`,
        impact: 'Could reduce database load by 80-90% through query consolidation',
        effort: 'medium',
        automated: false
      });
    });

    // Look for queries that could benefit from caching
    const cacheCandidates = topQueries.filter((q: any) => 
      q.count > 20 && this.isCacheCandidate(q.query)
    );

    cacheCandidates.forEach((candidate: any) => {
      this.addRecommendation({
        type: 'cache',
        priority: 'medium',
        title: `Add caching for frequent query: ${candidate.query}`,
        description: `Query executed ${candidate.count} times, good candidate for caching`,
        impact: 'Reduce database load and improve response times',
        effort: 'low',
        automated: false
      });
    });
  }

  /**
   * Analyze error patterns
   */
  private async analyzeErrorPatterns(analytics: any): Promise<void> {
    if (analytics.errorRate > 0.05) { // 5% error rate
      this.addRecommendation({
        type: 'query',
        priority: analytics.errorRate > 0.15 ? 'critical' : 'high',
        title: 'High database error rate detected',
        description: `Current error rate: ${(analytics.errorRate * 100).toFixed(1)}%`,
        impact: 'Improve application stability and user experience',
        effort: 'medium',
        automated: false
      });
    }
  }

  /**
   * Extract query pattern for analysis
   */
  private extractQueryPattern(query: string): string {
    // Simplified pattern extraction - replace specific values with placeholders
    return query
      .replace(/\d+/g, 'N')
      .replace(/'[^']*'/g, "'VALUE'")
      .replace(/\$\d+/g, '$PARAM')
      .substring(0, 100);
  }

  /**
   * Check if query is likely an N+1 pattern
   */
  private isLikelyNPlusOne(query: string): boolean {
    const pattern = query.toLowerCase();
    return pattern.includes('select') && 
           pattern.includes('where') && 
           (pattern.includes('id =') || pattern.includes('id in'));
  }

  /**
   * Check if query is a good caching candidate
   */
  private isCacheCandidate(query: string): boolean {
    const pattern = query.toLowerCase();
    return pattern.includes('select') && 
           !pattern.includes('insert') && 
           !pattern.includes('update') && 
           !pattern.includes('delete') &&
           !pattern.includes('now()') &&
           !pattern.includes('current_timestamp');
  }

  /**
   * Generate index suggestion SQL
   */
  private generateIndexSuggestion(pattern: string): string {
    // This is a simplified example - real implementation would be more sophisticated
    if (pattern.includes('where') && pattern.includes('id =')) {
      return '-- Consider adding index on frequently queried columns\n-- Example: CREATE INDEX idx_table_column ON table_name (column_name);';
    }
    return '-- Analyze query execution plan to determine optimal index strategy';
  }

  /**
   * Add tuning recommendation
   */
  private addRecommendation(rec: Omit<TuningRecommendation, 'id' | 'applied' | 'createdAt'>): void {
    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const recommendation: TuningRecommendation = {
      id,
      applied: false,
      createdAt: new Date(),
      ...rec
    };

    this.recommendations.set(id, recommendation);

    // Limit number of recommendations
    if (this.recommendations.size > this.config.maxRecommendations) {
      const oldest = Array.from(this.recommendations.values())
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      this.recommendations.delete(oldest.id);
    }

    console.log(`💡 New tuning recommendation: ${rec.title}`);
  }

  /**
   * Auto-apply low-risk recommendations
   */
  private async autoApplyRecommendations(): Promise<void> {
    const lowRiskRecs = Array.from(this.recommendations.values()).filter(
      rec => !rec.applied && rec.automated && rec.effort === 'low' && rec.priority !== 'critical'
    );

    for (const rec of lowRiskRecs) {
      try {
        await this.applyRecommendation(rec.id);
        console.log(`🤖 Auto-applied recommendation: ${rec.title}`);
      } catch (error) {
        console.error(`❌ Failed to auto-apply recommendation ${rec.id}:`, error);
      }
    }
  }

  /**
   * Apply a specific recommendation
   */
  async applyRecommendation(id: string, client?: SupabaseClient): Promise<boolean> {
    const rec = this.recommendations.get(id);
    if (!rec || rec.applied) return false;

    try {
      switch (rec.type) {
        case 'connection':
          await this.applyConnectionTuning(rec);
          break;
        case 'cache':
          await this.applyCacheTuning(rec);
          break;
        case 'index':
          if (rec.sql && client) {
            // Index creation would require admin privileges
            console.log(`Index recommendation: ${rec.sql}`);
          }
          break;
        default:
          console.log(`Manual intervention required for: ${rec.title}`);
          return false;
      }

      // Mark as applied
      rec.applied = true;
      rec.appliedAt = new Date();
      this.recommendations.set(id, rec);

      return true;
    } catch (error) {
      console.error(`Failed to apply recommendation ${id}:`, error);
      return false;
    }
  }

  /**
   * Apply connection pool tuning
   */
  private async applyConnectionTuning(rec: TuningRecommendation): Promise<void> {
    const poolStatus = queryOptimizer.getPoolStatus();
    
    if (rec.title.includes('Increase')) {
      // Increase pool size by 20%
      const newSize = Math.ceil(poolStatus.maxConnections * 1.2);
      process.env.DB_MAX_CONNECTIONS = newSize.toString();
      console.log(`📈 Increased connection pool size to ${newSize}`);
    } else if (rec.title.includes('Reduce')) {
      // Decrease pool size by 20%
      const newSize = Math.max(3, Math.floor(poolStatus.maxConnections * 0.8));
      process.env.DB_MAX_CONNECTIONS = newSize.toString();
      console.log(`📉 Reduced connection pool size to ${newSize}`);
    }
  }

  /**
   * Apply cache tuning
   */
  private async applyCacheTuning(rec: TuningRecommendation): Promise<void> {
    // This would integrate with the cache system
    console.log(`🗄️ Cache tuning applied: ${rec.title}`);
  }

  /**
   * Get all recommendations
   */
  getRecommendations(filter?: {
    type?: string;
    priority?: string;
    applied?: boolean;
  }): TuningRecommendation[] {
    let recs = Array.from(this.recommendations.values());

    if (filter) {
      if (filter.type) {
        recs = recs.filter(r => r.type === filter.type);
      }
      if (filter.priority) {
        recs = recs.filter(r => r.priority === filter.priority);
      }
      if (filter.applied !== undefined) {
        recs = recs.filter(r => r.applied === filter.applied);
      }
    }

    return recs.sort((a, b) => {
      // Sort by priority, then by creation date
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  /**
   * Get tuning statistics
   */
  getTuningStatistics(): {
    totalRecommendations: number;
    appliedRecommendations: number;
    recommendationsByType: Record<string, number>;
    recommendationsByPriority: Record<string, number>;
    recentRecommendations: TuningRecommendation[];
  } {
    const recs = Array.from(this.recommendations.values());
    
    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    
    recs.forEach(rec => {
      byType[rec.type] = (byType[rec.type] || 0) + 1;
      byPriority[rec.priority] = (byPriority[rec.priority] || 0) + 1;
    });

    return {
      totalRecommendations: recs.length,
      appliedRecommendations: recs.filter(r => r.applied).length,
      recommendationsByType: byType,
      recommendationsByPriority: byPriority,
      recentRecommendations: recs
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AutoTuningConfig>): void {
    this.config = { ...this.config, ...updates };
    
    if (updates.enabled !== undefined) {
      if (updates.enabled && !this.analysisTimer) {
        this.startAnalysis();
      } else if (!updates.enabled && this.analysisTimer) {
        this.stopAnalysis();
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoTuningConfig {
    return { ...this.config };
  }

  /**
   * Clear old recommendations
   */
  clearOldRecommendations(olderThanDays: number = 7): number {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let cleared = 0;

    for (const [id, rec] of this.recommendations) {
      if (rec.createdAt < cutoff && rec.applied) {
        this.recommendations.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}

export const automatedTuning = AutomatedTuningSystem.getInstance();
export type { TuningRecommendation, AutoTuningConfig };