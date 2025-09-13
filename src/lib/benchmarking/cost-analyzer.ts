/**
 * Cost Analysis and ROI Tracking System
 * Tracks function usage costs and calculates ROI from optimization efforts
 */

export interface CostMetrics {
  functionInvocations: number;
  executionTime: number; // milliseconds
  memoryUsage: number; // MB-seconds
  bandwidthUsage: number; // GB
  storageUsage: number; // GB
  databaseQueries: number;
  cacheOperations: number;
  timestamp: Date;
}

export interface CostBreakdown {
  functionCosts: number;
  computeCosts: number;
  memoryCosts: number;
  bandwidthCosts: number;
  storageCosts: number;
  databaseCosts: number;
  cacheCosts: number;
  totalCost: number;
}

export interface ROIAnalysis {
  period: string;
  beforeOptimization: CostBreakdown;
  afterOptimization: CostBreakdown;
  savings: {
    absolute: number;
    percentage: number;
    monthly: number;
    yearly: number;
  };
  optimizationCost: number;
  paybackPeriod: number; // months
  roi: number; // percentage
  netBenefit: number;
}

export interface CostProjection {
  timeframe: 'monthly' | 'quarterly' | 'yearly';
  currentTrajectory: number;
  optimizedTrajectory: number;
  projectedSavings: number;
  confidenceLevel: number; // percentage
}

export interface CostOptimizationRecommendation {
  category: 'functions' | 'compute' | 'memory' | 'bandwidth' | 'storage' | 'database' | 'cache';
  priority: 'high' | 'medium' | 'low';
  description: string;
  estimatedSavings: number;
  implementationEffort: 'low' | 'medium' | 'high';
  timeToImplement: number; // days
}

export class CostAnalyzer {
  private readonly PRICING = {
    // Netlify Functions pricing (approximate)
    functionInvocation: 0.0000025, // $2.50 per million invocations
    computeGBSecond: 0.0000166667, // $60 per million GB-seconds
    bandwidth: 0.55, // $0.55 per GB
    
    // Supabase pricing (approximate)
    databaseQuery: 0.000001, // $1 per million queries
    storage: 0.125, // $0.125 per GB per month
    
    // General cloud costs
    cache: 0.02 // $0.02 per GB per month
  };

  private costHistory: CostMetrics[] = [];
  private baselineCosts: CostBreakdown | null = null;

  /**
   * Calculate current cost breakdown
   */
  async calculateCurrentCosts(): Promise<CostBreakdown> {
    console.log('💰 Calculating current costs...');
    
    const metrics = await this.collectCostMetrics();
    const breakdown = this.calculateCostBreakdown(metrics);
    
    console.log(`💰 Total current cost: $${breakdown.totalCost.toFixed(4)}`);
    
    return breakdown;
  }

  /**
   * Establish cost baseline
   */
  async establishCostBaseline(): Promise<CostBreakdown> {
    console.log('📊 Establishing cost baseline...');
    
    const baseline = await this.calculateCurrentCosts();
    this.baselineCosts = baseline;
    
    // Store baseline for persistence
    await this.storeCostBaseline(baseline);
    
    console.log('✅ Cost baseline established');
    return baseline;
  }

  /**
   * Calculate ROI analysis
   */
  async calculateROI(
    optimizationCost: number = 0,
    period: string = '30-day'
  ): Promise<ROIAnalysis> {
    console.log('📈 Calculating ROI analysis...');
    
    if (!this.baselineCosts) {
      throw new Error('No cost baseline available. Run establishCostBaseline() first.');
    }

    const currentCosts = await this.calculateCurrentCosts();
    
    const absoluteSavings = this.baselineCosts.totalCost - currentCosts.totalCost;
    const percentageSavings = (absoluteSavings / this.baselineCosts.totalCost) * 100;
    
    // Project to monthly and yearly savings
    const dailySavings = absoluteSavings; // Assuming period is daily
    const monthlySavings = dailySavings * 30;
    const yearlySavings = dailySavings * 365;
    
    // Calculate payback period
    const paybackPeriod = optimizationCost > 0 ? optimizationCost / monthlySavings : 0;
    
    // Calculate ROI (return on investment)
    const roi = optimizationCost > 0 ? (yearlySavings / optimizationCost) * 100 : Infinity;
    
    // Calculate net benefit (savings minus optimization cost over 1 year)
    const netBenefit = yearlySavings - optimizationCost;

    const analysis: ROIAnalysis = {
      period,
      beforeOptimization: this.baselineCosts,
      afterOptimization: currentCosts,
      savings: {
        absolute: absoluteSavings,
        percentage: percentageSavings,
        monthly: monthlySavings,
        yearly: yearlySavings
      },
      optimizationCost,
      paybackPeriod,
      roi,
      netBenefit
    };

    console.log(`📈 ROI Analysis: ${roi.toFixed(1)}% ROI, $${monthlySavings.toFixed(2)}/month savings`);
    
    return analysis;
  }

  /**
   * Generate cost projections
   */
  generateCostProjections(timeframe: 'monthly' | 'quarterly' | 'yearly'): CostProjection[] {
    console.log(`📊 Generating ${timeframe} cost projections...`);
    
    if (this.costHistory.length < 7) {
      console.warn('Insufficient historical data for accurate projections');
      return [];
    }

    const projections: CostProjection[] = [];
    const multiplier = timeframe === 'monthly' ? 30 : timeframe === 'quarterly' ? 90 : 365;

    // Calculate trend from historical data
    const recentCosts = this.costHistory.slice(-7); // Last 7 data points
    const trend = this.calculateCostTrend(recentCosts);
    
    // Current trajectory (without optimization)
    const currentDailyCost = this.calculateDailyCost(recentCosts[recentCosts.length - 1]);
    const currentTrajectory = currentDailyCost * multiplier;
    
    // Optimized trajectory (with current optimizations)
    const optimizedDailyCost = currentDailyCost * (1 + trend.optimizationImpact);
    const optimizedTrajectory = optimizedDailyCost * multiplier;
    
    const projectedSavings = currentTrajectory - optimizedTrajectory;
    const confidenceLevel = this.calculateConfidenceLevel(recentCosts);

    projections.push({
      timeframe,
      currentTrajectory,
      optimizedTrajectory,
      projectedSavings,
      confidenceLevel
    });

    console.log(`📊 ${timeframe} projection: $${projectedSavings.toFixed(2)} savings (${confidenceLevel}% confidence)`);
    
    return projections;
  }

  /**
   * Generate cost optimization recommendations
   */
  generateOptimizationRecommendations(): CostOptimizationRecommendation[] {
    console.log('💡 Generating cost optimization recommendations...');
    
    const recommendations: CostOptimizationRecommendation[] = [];

    if (!this.baselineCosts) {
      return recommendations;
    }

    // Function consolidation recommendations
    if (this.baselineCosts.functionCosts > 10) {
      recommendations.push({
        category: 'functions',
        priority: 'high',
        description: 'Consolidate similar API routes to reduce function count and cold starts',
        estimatedSavings: this.baselineCosts.functionCosts * 0.4, // 40% reduction
        implementationEffort: 'medium',
        timeToImplement: 14
      });
    }

    // Memory optimization recommendations
    if (this.baselineCosts.memoryCosts > 5) {
      recommendations.push({
        category: 'memory',
        priority: 'medium',
        description: 'Optimize memory usage in functions to reduce memory-time costs',
        estimatedSavings: this.baselineCosts.memoryCosts * 0.25, // 25% reduction
        implementationEffort: 'low',
        timeToImplement: 7
      });
    }

    // Caching recommendations
    if (this.baselineCosts.computeCosts > 15) {
      recommendations.push({
        category: 'cache',
        priority: 'high',
        description: 'Implement intelligent caching to reduce compute costs',
        estimatedSavings: this.baselineCosts.computeCosts * 0.3, // 30% reduction
        implementationEffort: 'medium',
        timeToImplement: 10
      });
    }

    // Database optimization recommendations
    if (this.baselineCosts.databaseCosts > 8) {
      recommendations.push({
        category: 'database',
        priority: 'medium',
        description: 'Optimize database queries and implement connection pooling',
        estimatedSavings: this.baselineCosts.databaseCosts * 0.35, // 35% reduction
        implementationEffort: 'high',
        timeToImplement: 21
      });
    }

    // Bandwidth optimization recommendations
    if (this.baselineCosts.bandwidthCosts > 20) {
      recommendations.push({
        category: 'bandwidth',
        priority: 'low',
        description: 'Implement response compression and optimize payload sizes',
        estimatedSavings: this.baselineCosts.bandwidthCosts * 0.15, // 15% reduction
        implementationEffort: 'low',
        timeToImplement: 5
      });
    }

    // Sort by estimated savings (highest first)
    recommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);

    console.log(`💡 Generated ${recommendations.length} optimization recommendations`);
    
    return recommendations;
  }

  /**
   * Track cost metrics over time
   */
  async trackCostMetrics(): Promise<void> {
    const metrics = await this.collectCostMetrics();
    this.costHistory.push(metrics);
    
    // Keep only last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    this.costHistory = this.costHistory.filter(
      m => m.timestamp >= thirtyDaysAgo
    );

    // Store metrics for persistence
    await this.storeCostMetrics(metrics);
  }

  /**
   * Collect current cost metrics
   */
  private async collectCostMetrics(): Promise<CostMetrics> {
    // In a real implementation, these would come from monitoring APIs
    const metrics: CostMetrics = {
      functionInvocations: await this.getFunctionInvocations(),
      executionTime: await this.getTotalExecutionTime(),
      memoryUsage: await this.getTotalMemoryUsage(),
      bandwidthUsage: await this.getBandwidthUsage(),
      storageUsage: await this.getStorageUsage(),
      databaseQueries: await this.getDatabaseQueries(),
      cacheOperations: await this.getCacheOperations(),
      timestamp: new Date()
    };

    return metrics;
  }

  /**
   * Calculate cost breakdown from metrics
   */
  private calculateCostBreakdown(metrics: CostMetrics): CostBreakdown {
    const functionCosts = metrics.functionInvocations * this.PRICING.functionInvocation;
    const computeCosts = (metrics.executionTime / 1000) * (metrics.memoryUsage / 1024) * this.PRICING.computeGBSecond;
    const memoryCosts = computeCosts; // Already included in compute costs
    const bandwidthCosts = metrics.bandwidthUsage * this.PRICING.bandwidth;
    const storageCosts = metrics.storageUsage * this.PRICING.storage / 30; // Daily cost
    const databaseCosts = metrics.databaseQueries * this.PRICING.databaseQuery;
    const cacheCosts = (metrics.cacheOperations / 1000000) * this.PRICING.cache / 30; // Daily cost

    return {
      functionCosts,
      computeCosts,
      memoryCosts: 0, // Included in compute costs
      bandwidthCosts,
      storageCosts,
      databaseCosts,
      cacheCosts,
      totalCost: functionCosts + computeCosts + bandwidthCosts + storageCosts + databaseCosts + cacheCosts
    };
  }

  /**
   * Calculate cost trend from historical data
   */
  private calculateCostTrend(costs: CostMetrics[]): { trend: number; optimizationImpact: number } {
    if (costs.length < 2) {
      return { trend: 0, optimizationImpact: 0 };
    }

    const dailyCosts = costs.map(c => this.calculateDailyCost(c));
    const firstHalf = dailyCosts.slice(0, Math.floor(dailyCosts.length / 2));
    const secondHalf = dailyCosts.slice(Math.floor(dailyCosts.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const trend = (secondAvg - firstAvg) / firstAvg;
    const optimizationImpact = Math.min(0, trend); // Only negative trends indicate optimization

    return { trend, optimizationImpact };
  }

  /**
   * Calculate daily cost from metrics
   */
  private calculateDailyCost(metrics: CostMetrics): number {
    const breakdown = this.calculateCostBreakdown(metrics);
    return breakdown.totalCost;
  }

  /**
   * Calculate confidence level for projections
   */
  private calculateConfidenceLevel(costs: CostMetrics[]): number {
    if (costs.length < 3) {
      return 50; // Low confidence with insufficient data
    }

    const dailyCosts = costs.map(c => this.calculateDailyCost(c));
    const mean = dailyCosts.reduce((a, b) => a + b, 0) / dailyCosts.length;
    const variance = dailyCosts.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / dailyCosts.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / mean;

    // Lower variation = higher confidence
    const confidence = Math.max(50, Math.min(95, 100 - (coefficientOfVariation * 100)));
    
    return Math.round(confidence);
  }

  /**
   * Get function invocations from monitoring
   */
  private async getFunctionInvocations(): Promise<number> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/monitoring/status`);
      if (response.ok) {
        const data = await response.json();
        return data.functionInvocations || 1000; // Default value
      }
    } catch (error) {
      console.warn('Failed to get function invocations:', error);
    }
    return 1000; // Default value
  }

  /**
   * Get total execution time from monitoring
   */
  private async getTotalExecutionTime(): Promise<number> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/monitoring/analytics`);
      if (response.ok) {
        const data = await response.json();
        return data.totalExecutionTime || 50000; // Default 50 seconds
      }
    } catch (error) {
      console.warn('Failed to get execution time:', error);
    }
    return 50000; // Default 50 seconds
  }

  /**
   * Get total memory usage from monitoring
   */
  private async getTotalMemoryUsage(): Promise<number> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/monitoring/status`);
      if (response.ok) {
        const data = await response.json();
        return data.memoryUsage || 512; // Default 512 MB
      }
    } catch (error) {
      console.warn('Failed to get memory usage:', error);
    }
    return 512; // Default 512 MB
  }

  /**
   * Get bandwidth usage from monitoring
   */
  private async getBandwidthUsage(): Promise<number> {
    // This would typically come from CDN/hosting provider metrics
    return 5.0; // Default 5 GB
  }

  /**
   * Get storage usage from monitoring
   */
  private async getStorageUsage(): Promise<number> {
    // This would typically come from database/storage provider metrics
    return 2.0; // Default 2 GB
  }

  /**
   * Get database queries from monitoring
   */
  private async getDatabaseQueries(): Promise<number> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/database/performance`);
      if (response.ok) {
        const data = await response.json();
        return data.queryCount || 10000; // Default value
      }
    } catch (error) {
      console.warn('Failed to get database queries:', error);
    }
    return 10000; // Default value
  }

  /**
   * Get cache operations from monitoring
   */
  private async getCacheOperations(): Promise<number> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cache/analytics`);
      if (response.ok) {
        const data = await response.json();
        return data.operations || 5000; // Default value
      }
    } catch (error) {
      console.warn('Failed to get cache operations:', error);
    }
    return 5000; // Default value
  }

  /**
   * Store cost baseline
   */
  private async storeCostBaseline(baseline: CostBreakdown): Promise<void> {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/cost-analysis/baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseline)
      });
    } catch (error) {
      console.warn('Failed to store cost baseline:', error);
    }
  }

  /**
   * Store cost metrics
   */
  private async storeCostMetrics(metrics: CostMetrics): Promise<void> {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/cost-analysis/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });
    } catch (error) {
      console.warn('Failed to store cost metrics:', error);
    }
  }

  /**
   * Get cost history
   */
  getCostHistory(): CostMetrics[] {
    return [...this.costHistory];
  }

  /**
   * Get baseline costs
   */
  getBaselineCosts(): CostBreakdown | null {
    return this.baselineCosts;
  }
}

export const costAnalyzer = new CostAnalyzer();