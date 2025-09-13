/**
 * Performance Analytics System
 * Provides trend analysis and capacity planning for function performance
 */

export interface PerformanceTrend {
  timestamp: Date;
  function_name: string;
  response_time: number;
  throughput: number;
  error_rate: number;
  memory_usage: number;
  cpu_usage: number;
}

export interface TrendAnalysis {
  function_name: string;
  period_days: number;
  trends: {
    response_time: TrendData;
    throughput: TrendData;
    error_rate: TrendData;
    memory_usage: TrendData;
  };
  predictions: {
    next_week: PerformancePrediction;
    next_month: PerformancePrediction;
  };
  anomalies: PerformanceAnomaly[];
}

export interface TrendData {
  current_value: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  change_percentage: number;
  confidence: number;
  data_points: Array<{ timestamp: Date; value: number }>;
}

export interface PerformancePrediction {
  response_time: { min: number; max: number; avg: number };
  throughput: { min: number; max: number; avg: number };
  error_rate: { min: number; max: number; avg: number };
  confidence: number;
}

export interface PerformanceAnomaly {
  timestamp: Date;
  function_name: string;
  metric: string;
  expected_value: number;
  actual_value: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface CapacityPlan {
  current_capacity: {
    max_concurrent_requests: number;
    avg_response_time: number;
    throughput_per_second: number;
  };
  projected_needs: {
    next_month: {
      estimated_load_increase: number;
      recommended_optimizations: string[];
      scaling_requirements: string[];
    };
    next_quarter: {
      estimated_load_increase: number;
      recommended_optimizations: string[];
      scaling_requirements: string[];
    };
  };
  bottlenecks: Array<{
    component: string;
    impact: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
}

class PerformanceAnalytics {
  private trends: Map<string, PerformanceTrend[]> = new Map();

  /**
   * Record performance trend data
   */
  recordTrend(trend: PerformanceTrend): void {
    const functionTrends = this.trends.get(trend.function_name) || [];
    functionTrends.push(trend);

    // Keep only last 10000 data points per function
    if (functionTrends.length > 10000) {
      functionTrends.splice(0, functionTrends.length - 10000);
    }

    this.trends.set(trend.function_name, functionTrends);
  }

  /**
   * Analyze trends for a function
   */
  analyzeTrends(functionName: string, days: number = 7): TrendAnalysis {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const trends = this.trends.get(functionName) || [];
    const recentTrends = trends.filter(t => t.timestamp >= cutoff);

    if (recentTrends.length === 0) {
      throw new Error(`No trend data available for function ${functionName}`);
    }

    // Analyze each metric
    const responseTimeTrend = this.analyzeTrendData(recentTrends, 'response_time');
    const throughputTrend = this.analyzeTrendData(recentTrends, 'throughput');
    const errorRateTrend = this.analyzeTrendData(recentTrends, 'error_rate');
    const memoryUsageTrend = this.analyzeTrendData(recentTrends, 'memory_usage');

    // Generate predictions
    const predictions = this.generatePredictions(recentTrends);

    // Detect anomalies
    const anomalies = this.detectAnomalies(recentTrends);

    return {
      function_name: functionName,
      period_days: days,
      trends: {
        response_time: responseTimeTrend,
        throughput: throughputTrend,
        error_rate: errorRateTrend,
        memory_usage: memoryUsageTrend
      },
      predictions,
      anomalies
    };
  }

  /**
   * Analyze trend data for a specific metric
   */
  private analyzeTrendData(trends: PerformanceTrend[], metric: keyof PerformanceTrend): TrendData {
    const values = trends.map(t => ({
      timestamp: t.timestamp,
      value: Number(t[metric])
    })).filter(v => !isNaN(v.value));

    if (values.length === 0) {
      return {
        current_value: 0,
        trend_direction: 'stable',
        change_percentage: 0,
        confidence: 0,
        data_points: []
      };
    }

    // Calculate linear regression for trend direction
    const { slope, confidence } = this.calculateLinearRegression(values);
    
    const currentValue = values[values.length - 1].value;
    const firstValue = values[0].value;
    const changePercentage = firstValue !== 0 ? ((currentValue - firstValue) / firstValue) * 100 : 0;

    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(slope) > 0.01) { // Threshold for significant change
      trendDirection = slope > 0 ? 'increasing' : 'decreasing';
    }

    return {
      current_value: currentValue,
      trend_direction: trendDirection,
      change_percentage: changePercentage,
      confidence,
      data_points: values
    };
  }

  /**
   * Calculate linear regression for trend analysis
   */
  private calculateLinearRegression(data: Array<{ timestamp: Date; value: number }>): { slope: number; confidence: number } {
    if (data.length < 2) {
      return { slope: 0, confidence: 0 };
    }

    // Convert timestamps to numeric values (hours since first point)
    const baseTime = data[0].timestamp.getTime();
    const points = data.map(d => ({
      x: (d.timestamp.getTime() - baseTime) / (1000 * 60 * 60), // Hours
      y: d.value
    }));

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
    const ssResidual = points.reduce((sum, p) => {
      const predicted = slope * p.x + (sumY - slope * sumX) / n;
      return sum + Math.pow(p.y - predicted, 2);
    }, 0);
    
    const rSquared = ssTotal !== 0 ? 1 - (ssResidual / ssTotal) : 0;
    const confidence = Math.max(0, Math.min(1, rSquared));

    return { slope, confidence };
  }

  /**
   * Generate performance predictions
   */
  private generatePredictions(trends: PerformanceTrend[]): {
    next_week: PerformancePrediction;
    next_month: PerformancePrediction;
  } {
    if (trends.length === 0) {
      const emptyPrediction: PerformancePrediction = {
        response_time: { min: 0, max: 0, avg: 0 },
        throughput: { min: 0, max: 0, avg: 0 },
        error_rate: { min: 0, max: 0, avg: 0 },
        confidence: 0
      };
      return { next_week: emptyPrediction, next_month: emptyPrediction };
    }

    // Simple prediction based on recent trends and seasonal patterns
    const recentTrends = trends.slice(-168); // Last week (assuming hourly data)
    
    const avgResponseTime = recentTrends.reduce((sum, t) => sum + t.response_time, 0) / recentTrends.length;
    const avgThroughput = recentTrends.reduce((sum, t) => sum + t.throughput, 0) / recentTrends.length;
    const avgErrorRate = recentTrends.reduce((sum, t) => sum + t.error_rate, 0) / recentTrends.length;

    // Add some variance for min/max predictions
    const responseTimeVariance = this.calculateVariance(recentTrends.map(t => t.response_time));
    const throughputVariance = this.calculateVariance(recentTrends.map(t => t.throughput));
    const errorRateVariance = this.calculateVariance(recentTrends.map(t => t.error_rate));

    const nextWeek: PerformancePrediction = {
      response_time: {
        min: Math.max(0, avgResponseTime - responseTimeVariance),
        max: avgResponseTime + responseTimeVariance,
        avg: avgResponseTime
      },
      throughput: {
        min: Math.max(0, avgThroughput - throughputVariance),
        max: avgThroughput + throughputVariance,
        avg: avgThroughput
      },
      error_rate: {
        min: Math.max(0, avgErrorRate - errorRateVariance),
        max: Math.min(100, avgErrorRate + errorRateVariance),
        avg: avgErrorRate
      },
      confidence: Math.min(1, recentTrends.length / 168) // Confidence based on data availability
    };

    // Monthly predictions with slightly more variance
    const nextMonth: PerformancePrediction = {
      response_time: {
        min: Math.max(0, avgResponseTime - responseTimeVariance * 1.5),
        max: avgResponseTime + responseTimeVariance * 1.5,
        avg: avgResponseTime * 1.1 // Assume slight degradation over time
      },
      throughput: {
        min: Math.max(0, avgThroughput - throughputVariance * 1.5),
        max: avgThroughput + throughputVariance * 1.5,
        avg: avgThroughput * 1.05 // Assume slight increase in load
      },
      error_rate: {
        min: Math.max(0, avgErrorRate - errorRateVariance * 1.5),
        max: Math.min(100, avgErrorRate + errorRateVariance * 1.5),
        avg: avgErrorRate
      },
      confidence: Math.min(0.8, recentTrends.length / 168) // Lower confidence for longer predictions
    };

    return { next_week: nextWeek, next_month: nextMonth };
  }

  /**
   * Calculate variance for a set of values
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Detect performance anomalies
   */
  private detectAnomalies(trends: PerformanceTrend[]): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];
    
    if (trends.length < 10) return anomalies; // Need sufficient data

    // Calculate baseline statistics for each metric
    const metrics = ['response_time', 'throughput', 'error_rate', 'memory_usage'] as const;
    
    for (const metric of metrics) {
      const values = trends.map(t => Number(t[metric])).filter(v => !isNaN(v));
      if (values.length === 0) continue;

      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
      
      // Detect outliers (values beyond 2 standard deviations)
      const threshold = 2;
      
      for (let i = 0; i < trends.length; i++) {
        const value = Number(trends[i][metric]);
        if (isNaN(value)) continue;

        const zScore = Math.abs((value - mean) / stdDev);
        
        if (zScore > threshold) {
          let severity: 'low' | 'medium' | 'high' = 'low';
          if (zScore > 3) severity = 'high';
          else if (zScore > 2.5) severity = 'medium';

          anomalies.push({
            timestamp: trends[i].timestamp,
            function_name: trends[i].function_name,
            metric,
            expected_value: mean,
            actual_value: value,
            severity,
            description: `${metric} value ${value.toFixed(2)} is ${zScore.toFixed(1)} standard deviations from normal (${mean.toFixed(2)})`
          });
        }
      }
    }

    return anomalies.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Generate capacity planning recommendations
   */
  generateCapacityPlan(functionName: string): CapacityPlan {
    const trends = this.trends.get(functionName) || [];
    const recentTrends = trends.slice(-168); // Last week

    if (recentTrends.length === 0) {
      return {
        current_capacity: {
          max_concurrent_requests: 0,
          avg_response_time: 0,
          throughput_per_second: 0
        },
        projected_needs: {
          next_month: {
            estimated_load_increase: 0,
            recommended_optimizations: [],
            scaling_requirements: []
          },
          next_quarter: {
            estimated_load_increase: 0,
            recommended_optimizations: [],
            scaling_requirements: []
          }
        },
        bottlenecks: []
      };
    }

    // Calculate current capacity metrics
    const avgResponseTime = recentTrends.reduce((sum, t) => sum + t.response_time, 0) / recentTrends.length;
    const avgThroughput = recentTrends.reduce((sum, t) => sum + t.throughput, 0) / recentTrends.length;
    const maxConcurrentRequests = Math.floor(1000 / avgResponseTime); // Rough estimate

    // Analyze trends for projections
    const analysis = this.analyzeTrends(functionName, 7);
    
    // Generate recommendations based on trends
    const recommendations: string[] = [];
    const scalingRequirements: string[] = [];
    const bottlenecks: Array<{ component: string; impact: 'low' | 'medium' | 'high'; recommendation: string }> = [];

    if (analysis.trends.response_time.trend_direction === 'increasing') {
      recommendations.push('Optimize database queries and implement caching');
      bottlenecks.push({
        component: 'Response Time',
        impact: 'high',
        recommendation: 'Implement query optimization and caching strategies'
      });
    }

    if (analysis.trends.error_rate.current_value > 5) {
      recommendations.push('Investigate and fix error sources');
      bottlenecks.push({
        component: 'Error Handling',
        impact: 'high',
        recommendation: 'Implement better error handling and monitoring'
      });
    }

    if (analysis.trends.memory_usage.trend_direction === 'increasing') {
      recommendations.push('Optimize memory usage and implement garbage collection');
      scalingRequirements.push('Consider increasing memory allocation');
    }

    return {
      current_capacity: {
        max_concurrent_requests: maxConcurrentRequests,
        avg_response_time: avgResponseTime,
        throughput_per_second: avgThroughput
      },
      projected_needs: {
        next_month: {
          estimated_load_increase: 20, // 20% increase assumption
          recommended_optimizations: recommendations,
          scaling_requirements: scalingRequirements
        },
        next_quarter: {
          estimated_load_increase: 50, // 50% increase assumption
          recommended_optimizations: [...recommendations, 'Consider function consolidation'],
          scaling_requirements: [...scalingRequirements, 'Plan for horizontal scaling']
        }
      },
      bottlenecks
    };
  }

  /**
   * Get all trend data for a function
   */
  getTrends(functionName: string, hours: number = 24): PerformanceTrend[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const trends = this.trends.get(functionName) || [];
    return trends.filter(t => t.timestamp >= cutoff);
  }

  /**
   * Clear old trend data
   */
  clearOldTrends(days: number = 30): void {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    for (const [functionName, trends] of this.trends.entries()) {
      const recentTrends = trends.filter(t => t.timestamp >= cutoff);
      this.trends.set(functionName, recentTrends);
    }
  }
}

// Singleton instance
export const performanceAnalytics = new PerformanceAnalytics();