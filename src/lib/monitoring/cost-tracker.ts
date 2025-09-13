/**
 * Cost Tracking and Optimization System
 * Tracks function usage costs and provides optimization recommendations
 */

export interface CostMetrics {
  function_name: string;
  invocations: number;
  execution_time_ms: number;
  memory_usage_mb: number;
  estimated_cost: number;
  period_start: Date;
  period_end: Date;
}

export interface CostAnalysis {
  total_cost: number;
  cost_by_function: Record<string, number>;
  optimization_opportunities: OptimizationRecommendation[];
  cost_trends: CostTrend[];
  projected_monthly_cost: number;
}

export interface OptimizationRecommendation {
  type: 'memory' | 'execution_time' | 'invocation_frequency' | 'consolidation';
  function_name: string;
  current_value: number;
  recommended_value: number;
  potential_savings: number;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export interface CostTrend {
  date: Date;
  total_cost: number;
  invocations: number;
  avg_execution_time: number;
}

class CostTracker {
  private metrics: Map<string, CostMetrics[]> = new Map();
  
  // Netlify Functions pricing (approximate)
  private readonly PRICING = {
    invocation_cost: 0.0000002, // $0.0000002 per invocation
    gb_second_cost: 0.0000166667, // $0.0000166667 per GB-second
    free_tier: {
      invocations: 125000, // Free invocations per month
      gb_seconds: 100 // Free GB-seconds per month
    }
  };

  /**
   * Record cost metrics for a function
   */
  recordMetrics(functionName: string, invocations: number, executionTimeMs: number, memoryUsageMb: number): void {
    const estimatedCost = this.calculateCost(invocations, executionTimeMs, memoryUsageMb);
    
    const metrics: CostMetrics = {
      function_name: functionName,
      invocations,
      execution_time_ms: executionTimeMs,
      memory_usage_mb: memoryUsageMb,
      estimated_cost: estimatedCost,
      period_start: new Date(),
      period_end: new Date()
    };

    const functionMetrics = this.metrics.get(functionName) || [];
    functionMetrics.push(metrics);

    // Keep only last 1000 entries per function
    if (functionMetrics.length > 1000) {
      functionMetrics.splice(0, functionMetrics.length - 1000);
    }

    this.metrics.set(functionName, functionMetrics);
  }

  /**
   * Calculate cost for given usage
   */
  private calculateCost(invocations: number, executionTimeMs: number, memoryUsageMb: number): number {
    // Convert to GB-seconds
    const gbSeconds = (memoryUsageMb / 1024) * (executionTimeMs / 1000);
    
    // Calculate costs
    const invocationCost = Math.max(0, invocations - this.PRICING.free_tier.invocations) * this.PRICING.invocation_cost;
    const computeCost = Math.max(0, gbSeconds - this.PRICING.free_tier.gb_seconds) * this.PRICING.gb_second_cost;
    
    return invocationCost + computeCost;
  }

  /**
   * Get cost analysis for a time period
   */
  getCostAnalysis(hours: number = 24): CostAnalysis {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    let totalCost = 0;
    const costByFunction: Record<string, number> = {};
    const allMetrics: CostMetrics[] = [];

    // Aggregate metrics from all functions
    for (const [functionName, metrics] of this.metrics.entries()) {
      const recentMetrics = metrics.filter(m => m.period_start >= cutoff);
      const functionCost = recentMetrics.reduce((sum, m) => sum + m.estimated_cost, 0);
      
      costByFunction[functionName] = functionCost;
      totalCost += functionCost;
      allMetrics.push(...recentMetrics);
    }

    // Generate optimization recommendations
    const optimizationOpportunities = this.generateOptimizationRecommendations();

    // Generate cost trends (daily for the past week)
    const costTrends = this.generateCostTrends(7);

    // Project monthly cost based on current usage
    const projectedMonthlyCost = (totalCost / hours) * 24 * 30;

    return {
      total_cost: totalCost,
      cost_by_function: costByFunction,
      optimization_opportunities: optimizationOpportunities,
      cost_trends: costTrends,
      projected_monthly_cost: projectedMonthlyCost
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    for (const [functionName, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;

      const recentMetrics = metrics.slice(-100); // Last 100 entries
      const avgExecutionTime = recentMetrics.reduce((sum, m) => sum + m.execution_time_ms, 0) / recentMetrics.length;
      const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memory_usage_mb, 0) / recentMetrics.length;
      const totalInvocations = recentMetrics.reduce((sum, m) => sum + m.invocations, 0);

      // High execution time recommendation
      if (avgExecutionTime > 5000) { // > 5 seconds
        const potentialSavings = this.calculateCost(totalInvocations, avgExecutionTime - 2000, avgMemoryUsage) - 
                                this.calculateCost(totalInvocations, avgExecutionTime, avgMemoryUsage);
        
        recommendations.push({
          type: 'execution_time',
          function_name: functionName,
          current_value: avgExecutionTime,
          recommended_value: Math.max(1000, avgExecutionTime * 0.6),
          potential_savings: Math.abs(potentialSavings),
          description: `Function has high execution time. Consider optimizing database queries or caching.`,
          priority: avgExecutionTime > 10000 ? 'high' : 'medium'
        });
      }

      // High memory usage recommendation
      if (avgMemoryUsage > 512) { // > 512MB
        const potentialSavings = this.calculateCost(totalInvocations, avgExecutionTime, avgMemoryUsage) - 
                                this.calculateCost(totalInvocations, avgExecutionTime, 256);
        
        recommendations.push({
          type: 'memory',
          function_name: functionName,
          current_value: avgMemoryUsage,
          recommended_value: 256,
          potential_savings: Math.abs(potentialSavings),
          description: `Function uses high memory. Consider optimizing data structures or processing.`,
          priority: avgMemoryUsage > 1024 ? 'high' : 'medium'
        });
      }

      // High invocation frequency recommendation
      if (totalInvocations > 10000) { // > 10k invocations in recent period
        recommendations.push({
          type: 'invocation_frequency',
          function_name: functionName,
          current_value: totalInvocations,
          recommended_value: totalInvocations * 0.7,
          potential_savings: this.calculateCost(totalInvocations * 0.3, avgExecutionTime, avgMemoryUsage),
          description: `Function has high invocation frequency. Consider implementing caching or batching.`,
          priority: totalInvocations > 50000 ? 'high' : 'medium'
        });
      }
    }

    // Sort by potential savings
    return recommendations.sort((a, b) => b.potential_savings - a.potential_savings);
  }

  /**
   * Generate cost trends over time
   */
  private generateCostTrends(days: number): CostTrend[] {
    const trends: CostTrend[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      let totalCost = 0;
      let totalInvocations = 0;
      let totalExecutionTime = 0;
      let metricCount = 0;

      for (const metrics of this.metrics.values()) {
        const dayMetrics = metrics.filter(m => 
          m.period_start >= date && m.period_start < nextDate
        );

        totalCost += dayMetrics.reduce((sum, m) => sum + m.estimated_cost, 0);
        totalInvocations += dayMetrics.reduce((sum, m) => sum + m.invocations, 0);
        totalExecutionTime += dayMetrics.reduce((sum, m) => sum + m.execution_time_ms, 0);
        metricCount += dayMetrics.length;
      }

      trends.push({
        date,
        total_cost: totalCost,
        invocations: totalInvocations,
        avg_execution_time: metricCount > 0 ? totalExecutionTime / metricCount : 0
      });
    }

    return trends;
  }

  /**
   * Get cost comparison before/after optimization
   */
  getCostComparison(beforeFunctionCount: number, afterFunctionCount: number): {
    before: number;
    after: number;
    savings: number;
    savings_percentage: number;
  } {
    // Estimate based on typical function usage
    const avgInvocationsPerFunction = 1000;
    const avgExecutionTime = 2000; // 2 seconds
    const avgMemoryUsage = 256; // 256MB

    const beforeCost = this.calculateCost(
      beforeFunctionCount * avgInvocationsPerFunction,
      avgExecutionTime,
      avgMemoryUsage
    ) * beforeFunctionCount;

    const afterCost = this.calculateCost(
      afterFunctionCount * avgInvocationsPerFunction,
      avgExecutionTime * 0.8, // 20% improvement from optimization
      avgMemoryUsage
    ) * afterFunctionCount;

    const savings = beforeCost - afterCost;
    const savingsPercentage = beforeCost > 0 ? (savings / beforeCost) * 100 : 0;

    return {
      before: beforeCost,
      after: afterCost,
      savings,
      savings_percentage: savingsPercentage
    };
  }

  /**
   * Get metrics for a specific function
   */
  getFunctionMetrics(functionName: string, hours: number = 24): CostMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const metrics = this.metrics.get(functionName) || [];
    return metrics.filter(m => m.period_start >= cutoff);
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(days: number = 30): void {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    for (const [functionName, metrics] of this.metrics.entries()) {
      const recentMetrics = metrics.filter(m => m.period_start >= cutoff);
      this.metrics.set(functionName, recentMetrics);
    }
  }
}

// Singleton instance
export const costTracker = new CostTracker();