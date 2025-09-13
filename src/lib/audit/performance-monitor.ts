// Use browser performance API or Node.js perf_hooks based on environment
let perf: any;
if (typeof window !== 'undefined') {
  perf = window.performance;
} else {
  // Node.js environment - use Date.now() as fallback
  perf = {
    now: () => Date.now()
  };
}

export interface PerformanceMetric {
  id: string;
  name: string;
  timestamp: Date;
  duration: number;
  memoryUsage?: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers?: number;
  };
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface BaselineMetrics {
  timestamp: Date;
  averageResponseTime: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  functionCount: number;
  errorRate: number;
  throughput: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private activeRequests = new Map<string, number>();

  /**
   * Start monitoring a function execution
   */
  startMonitoring(id: string, name: string, metadata?: Record<string, any>): string {
    const requestId = `${id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeRequests.set(requestId, perf.now());
    
    return requestId;
  }

  /**
   * End monitoring and record metrics
   */
  endMonitoring(requestId: string, success: boolean = true, error?: string): PerformanceMetric | null {
    const startTime = this.activeRequests.get(requestId);
    if (!startTime) {
      console.warn(`⚠️  No start time found for request ${requestId}`);
      return null;
    }

    const endTime = perf.now();
    const duration = endTime - startTime;
    
    const metric: PerformanceMetric = {
      id: requestId,
      name: requestId.split('_')[0],
      timestamp: new Date(),
      duration,
      memoryUsage: typeof process !== 'undefined' ? process.memoryUsage() : undefined,
      success,
      error
    };

    this.metrics.push(metric);
    this.activeRequests.delete(requestId);

    return metric;
  }

  /**
   * Monitor a function execution with automatic timing
   */
  async monitor<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const requestId = this.startMonitoring(name, name, metadata);
    
    try {
      const result = await fn();
      this.endMonitoring(requestId, true);
      return result;
    } catch (error) {
      this.endMonitoring(requestId, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get metrics for a specific function
   */
  getMetricsForFunction(functionName: string): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.name === functionName);
  }

  /**
   * Get all metrics within a time range
   */
  getMetricsInRange(startTime: Date, endTime: Date): PerformanceMetric[] {
    return this.metrics.filter(
      metric => metric.timestamp >= startTime && metric.timestamp <= endTime
    );
  }

  /**
   * Calculate baseline metrics
   */
  calculateBaseline(): BaselineMetrics {
    if (this.metrics.length === 0) {
      throw new Error('No metrics available to calculate baseline');
    }

    const successfulMetrics = this.metrics.filter(m => m.success);
    const totalMetrics = this.metrics.length;
    
    // Calculate average response time
    const averageResponseTime = successfulMetrics.reduce((sum, m) => sum + m.duration, 0) / successfulMetrics.length;
    
    // Calculate error rate
    const errorRate = ((totalMetrics - successfulMetrics.length) / totalMetrics) * 100;
    
    // Get latest memory usage
    const defaultMemory = {
      rss: 0,
      heapUsed: 0,
      heapTotal: 0,
      external: 0
    };
    const latestMemoryUsage = this.metrics[this.metrics.length - 1]?.memoryUsage || 
      (typeof process !== 'undefined' ? process.memoryUsage() : defaultMemory);
    
    // Calculate throughput (requests per minute)
    const timeSpan = this.getTimeSpanMinutes();
    const throughput = timeSpan > 0 ? totalMetrics / timeSpan : 0;
    
    // Get unique function count
    const functionCount = new Set(this.metrics.map(m => m.name)).size;

    return {
      timestamp: new Date(),
      averageResponseTime,
      memoryUsage: {
        rss: latestMemoryUsage.rss,
        heapUsed: latestMemoryUsage.heapUsed,
        heapTotal: latestMemoryUsage.heapTotal,
        external: latestMemoryUsage.external
      },
      functionCount,
      errorRate,
      throughput
    };
  }

  /**
   * Get time span of collected metrics in minutes
   */
  private getTimeSpanMinutes(): number {
    if (this.metrics.length < 2) return 0;
    
    const earliest = Math.min(...this.metrics.map(m => m.timestamp.getTime()));
    const latest = Math.max(...this.metrics.map(m => m.timestamp.getTime()));
    
    return (latest - earliest) / (1000 * 60); // Convert to minutes
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: BaselineMetrics;
    functionBreakdown: Array<{
      name: string;
      count: number;
      averageTime: number;
      errorRate: number;
      totalTime: number;
    }>;
    slowestFunctions: Array<{
      name: string;
      maxTime: number;
      averageTime: number;
    }>;
    recommendations: string[];
  } {
    const baseline = this.calculateBaseline();
    
    // Function breakdown
    const functionStats = new Map<string, {
      count: number;
      totalTime: number;
      errors: number;
      maxTime: number;
    }>();

    this.metrics.forEach(metric => {
      const stats = functionStats.get(metric.name) || {
        count: 0,
        totalTime: 0,
        errors: 0,
        maxTime: 0
      };
      
      stats.count++;
      stats.totalTime += metric.duration;
      stats.maxTime = Math.max(stats.maxTime, metric.duration);
      if (!metric.success) stats.errors++;
      
      functionStats.set(metric.name, stats);
    });

    const functionBreakdown = Array.from(functionStats.entries()).map(([name, stats]) => ({
      name,
      count: stats.count,
      averageTime: stats.totalTime / stats.count,
      errorRate: (stats.errors / stats.count) * 100,
      totalTime: stats.totalTime
    }));

    // Slowest functions
    const slowestFunctions = functionBreakdown
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10)
      .map(f => ({
        name: f.name,
        maxTime: functionStats.get(f.name)?.maxTime || 0,
        averageTime: f.averageTime
      }));

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (baseline.averageResponseTime > 1000) {
      recommendations.push('Average response time is high (>1s). Consider function consolidation.');
    }
    
    if (baseline.errorRate > 5) {
      recommendations.push(`Error rate is ${baseline.errorRate.toFixed(1)}%. Investigate failing functions.`);
    }
    
    if (baseline.functionCount > 50) {
      recommendations.push(`${baseline.functionCount} functions detected. Strong candidate for consolidation.`);
    }
    
    const memoryMB = baseline.memoryUsage.heapUsed / (1024 * 1024);
    if (memoryMB > 100) {
      recommendations.push(`High memory usage (${memoryMB.toFixed(1)}MB). Optimize memory-intensive functions.`);
    }

    return {
      summary: baseline,
      functionBreakdown,
      slowestFunctions,
      recommendations
    };
  }

  /**
   * Export metrics to JSON
   */
  async exportMetrics(filePath: string): Promise<void> {
    const report = this.generateReport();
    const exportData = {
      timestamp: new Date().toISOString(),
      report,
      rawMetrics: this.metrics
    };

    if (typeof window === 'undefined') {
      const fs = await import('fs/promises');
      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
      console.log(`📊 Performance metrics exported to ${filePath}`);
    } else {
      // Browser environment - download as file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath;
      a.click();
      URL.revokeObjectURL(url);
      console.log(`📊 Performance metrics downloaded as ${filePath}`);
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.activeRequests.clear();
  }

  /**
   * Get current metrics count
   */
  getMetricsCount(): number {
    return this.metrics.length;
  }

  /**
   * Simulate baseline measurements for existing functions
   */
  async simulateBaseline(functionNames: string[]): Promise<BaselineMetrics> {
    console.log('🔄 Simulating baseline measurements...');
    
    // Simulate metrics for each function
    for (const functionName of functionNames) {
      // Simulate 5-10 requests per function
      const requestCount = Math.floor(Math.random() * 6) + 5;
      
      for (let i = 0; i < requestCount; i++) {
        const baseTime = Math.random() * 500 + 100; // 100-600ms base
        const complexity = Math.random();
        const responseTime = complexity > 0.8 ? baseTime * 2 : baseTime; // Some slow requests
        
        const metric: PerformanceMetric = {
          id: `sim_${functionName}_${i}`,
          name: functionName,
          timestamp: new Date(Date.now() - Math.random() * 3600000), // Random time in last hour
          duration: responseTime,
          memoryUsage: {
            rss: Math.floor(Math.random() * 50000000) + 20000000, // 20-70MB
            heapUsed: Math.floor(Math.random() * 30000000) + 10000000, // 10-40MB
            heapTotal: Math.floor(Math.random() * 40000000) + 20000000, // 20-60MB
            external: Math.floor(Math.random() * 5000000) + 1000000, // 1-6MB
            arrayBuffers: 0
          },
          success: Math.random() > 0.05, // 95% success rate
          error: Math.random() > 0.95 ? 'Simulated error' : undefined
        };
        
        this.metrics.push(metric);
      }
    }
    
    console.log(`✅ Simulated ${this.metrics.length} baseline measurements`);
    return this.calculateBaseline();
  }
}

// Global instance for easy access
export const performanceMonitor = new PerformanceMonitor();