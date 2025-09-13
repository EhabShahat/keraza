/**
 * Performance Benchmarking System
 * Provides automated performance testing and baseline comparison tools
 */

export interface BenchmarkMetrics {
    responseTime: number;
    throughput: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
    functionCount: number;
    cacheHitRate: number;
    databaseQueryTime: number;
    timestamp: Date;
}

export interface BenchmarkTest {
    id: string;
    name: string;
    endpoint: string;
    method: string;
    payload?: any;
    expectedStatus: number;
    timeout: number;
    iterations: number;
}

export interface BenchmarkResult {
    testId: string;
    metrics: BenchmarkMetrics;
    success: boolean;
    errors: string[];
    duration: number;
    iterations: number;
}

export interface BenchmarkComparison {
    baseline: BenchmarkMetrics;
    current: BenchmarkMetrics;
    improvements: {
        responseTime: number;
        throughput: number;
        errorRate: number;
        memoryUsage: number;
        functionCount: number;
    };
    regressions: string[];
    overallScore: number;
}

export class PerformanceBenchmarker {
    private baselineMetrics: BenchmarkMetrics | null = null;
    private testResults: BenchmarkResult[] = [];

    /**
     * Establish performance baseline metrics
     */
    async establishBaseline(): Promise<BenchmarkMetrics> {
        console.log('🔍 Establishing performance baseline...');

        const baseline = await this.collectSystemMetrics();
        this.baselineMetrics = baseline;

        // Store baseline in database for persistence
        await this.storeBaseline(baseline);

        console.log('✅ Baseline established:', {
            responseTime: `${baseline.responseTime}ms`,
            functionCount: baseline.functionCount,
            errorRate: `${baseline.errorRate}%`
        });

        return baseline;
    }

    /**
     * Run comprehensive performance test suite
     */
    async runBenchmarkSuite(tests: BenchmarkTest[]): Promise<BenchmarkResult[]> {
        console.log(`🚀 Running benchmark suite with ${tests.length} tests...`);

        const results: BenchmarkResult[] = [];

        for (const test of tests) {
            console.log(`Running test: ${test.name}`);
            const result = await this.runSingleBenchmark(test);
            results.push(result);

            // Brief pause between tests to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.testResults = results;
        await this.storeResults(results);

        console.log('✅ Benchmark suite completed');
        return results;
    }

    /**
     * Run a single benchmark test
     */
    private async runSingleBenchmark(test: BenchmarkTest): Promise<BenchmarkResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        let successCount = 0;
        const responseTimes: number[] = [];

        for (let i = 0; i < test.iterations; i++) {
            try {
                const iterationStart = Date.now();

                const response = await fetch(test.endpoint, {
                    method: test.method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': process.env.BENCHMARK_AUTH_TOKEN || ''
                    },
                    body: test.payload ? JSON.stringify(test.payload) : undefined,
                    signal: AbortSignal.timeout(test.timeout)
                });

                const iterationTime = Date.now() - iterationStart;
                responseTimes.push(iterationTime);

                if (response.status === test.expectedStatus) {
                    successCount++;
                } else {
                    errors.push(`Iteration ${i + 1}: Expected status ${test.expectedStatus}, got ${response.status}`);
                }
            } catch (error) {
                errors.push(`Iteration ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        const duration = Date.now() - startTime;
        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0;

        const metrics: BenchmarkMetrics = {
            responseTime: avgResponseTime,
            throughput: (successCount / duration) * 1000, // requests per second
            errorRate: ((test.iterations - successCount) / test.iterations) * 100,
            memoryUsage: await this.getMemoryUsage(),
            cpuUsage: await this.getCpuUsage(),
            functionCount: await this.getFunctionCount(),
            cacheHitRate: await this.getCacheHitRate(),
            databaseQueryTime: await this.getDatabaseQueryTime(),
            timestamp: new Date()
        };

        return {
            testId: test.id,
            metrics,
            success: errors.length === 0,
            errors,
            duration,
            iterations: test.iterations
        };
    }

    /**
     * Compare current performance against baseline
     */
    async compareWithBaseline(currentMetrics?: BenchmarkMetrics): Promise<BenchmarkComparison> {
        if (!this.baselineMetrics) {
            throw new Error('No baseline metrics available. Run establishBaseline() first.');
        }

        const current = currentMetrics || await this.collectSystemMetrics();

        const improvements = {
            responseTime: ((this.baselineMetrics.responseTime - current.responseTime) / this.baselineMetrics.responseTime) * 100,
            throughput: ((current.throughput - this.baselineMetrics.throughput) / this.baselineMetrics.throughput) * 100,
            errorRate: this.baselineMetrics.errorRate - current.errorRate,
            memoryUsage: ((this.baselineMetrics.memoryUsage - current.memoryUsage) / this.baselineMetrics.memoryUsage) * 100,
            functionCount: this.baselineMetrics.functionCount - current.functionCount
        };

        const regressions: string[] = [];
        if (improvements.responseTime < 0) regressions.push('Response time increased');
        if (improvements.throughput < 0) regressions.push('Throughput decreased');
        if (improvements.errorRate < 0) regressions.push('Error rate increased');
        if (improvements.memoryUsage < 0) regressions.push('Memory usage increased');

        // Calculate overall score (0-100, higher is better)
        const overallScore = Math.max(0, Math.min(100,
            50 + (improvements.responseTime * 0.3) +
            (improvements.throughput * 0.3) +
            (improvements.errorRate * 0.2) +
            (improvements.memoryUsage * 0.2)
        ));

        return {
            baseline: this.baselineMetrics,
            current,
            improvements,
            regressions,
            overallScore
        };
    }

    /**
     * Collect current system metrics (private method)
     */
    private async collectSystemMetrics(): Promise<BenchmarkMetrics> {
        return {
            responseTime: await this.measureAverageResponseTime(),
            throughput: await this.measureThroughput(),
            errorRate: await this.measureErrorRate(),
            memoryUsage: await this.getMemoryUsage(),
            cpuUsage: await this.getCpuUsage(),
            functionCount: await this.getFunctionCount(),
            cacheHitRate: await this.getCacheHitRate(),
            databaseQueryTime: await this.getDatabaseQueryTime(),
            timestamp: new Date()
        };
    }

    /**
     * Get current system metrics (public wrapper)
     */
    public async getCurrentMetrics(): Promise<BenchmarkMetrics> {
        return this.collectSystemMetrics();
    }

    /**
     * Measure average response time across key endpoints
     */
    private async measureAverageResponseTime(): Promise<number> {
        const endpoints = [
            '/api/admin/health',
            '/api/public/health',
            '/api/attempts/health'
        ];

        const times: number[] = [];

        for (const endpoint of endpoints) {
            try {
                const start = Date.now();
                const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${endpoint}`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok) {
                    times.push(Date.now() - start);
                }
            } catch (error) {
                console.warn(`Failed to measure response time for ${endpoint}:`, error);
            }
        }

        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }

    /**
     * Measure system throughput
     */
    private async measureThroughput(): Promise<number> {
        const endpoint = '/api/public/health';
        const concurrentRequests = 10;
        const testDuration = 5000; // 5 seconds

        const startTime = Date.now();
        let completedRequests = 0;

        const promises = Array(concurrentRequests).fill(null).map(async () => {
            while (Date.now() - startTime < testDuration) {
                try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${endpoint}`, {
                        signal: AbortSignal.timeout(1000)
                    });
                    if (response.ok) {
                        completedRequests++;
                    }
                } catch (error) {
                    // Ignore individual request failures for throughput measurement
                }
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        });

        await Promise.all(promises);

        return (completedRequests / testDuration) * 1000; // requests per second
    }

    /**
     * Measure error rate
     */
    private async measureErrorRate(): Promise<number> {
        // This would typically query monitoring data
        // For now, return a placeholder
        return 0;
    }

    /**
     * Get memory usage metrics
     */
    private async getMemoryUsage(): Promise<number> {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const usage = process.memoryUsage();
            return usage.heapUsed / 1024 / 1024; // MB
        }
        return 0;
    }

    /**
     * Get CPU usage metrics
     */
    private async getCpuUsage(): Promise<number> {
        // This would typically query system metrics
        // For now, return a placeholder
        return 0;
    }

    /**
     * Get current function count
     */
    private async getFunctionCount(): Promise<number> {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/monitoring/status`);
            if (response.ok) {
                const data = await response.json();
                return data.functionCount || 0;
            }
        } catch (error) {
            console.warn('Failed to get function count:', error);
        }
        return 0;
    }

    /**
     * Get cache hit rate
     */
    private async getCacheHitRate(): Promise<number> {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cache/analytics`);
            if (response.ok) {
                const data = await response.json();
                return data.hitRate || 0;
            }
        } catch (error) {
            console.warn('Failed to get cache hit rate:', error);
        }
        return 0;
    }

    /**
     * Get database query time
     */
    private async getDatabaseQueryTime(): Promise<number> {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/database/performance`);
            if (response.ok) {
                const data = await response.json();
                return data.averageQueryTime || 0;
            }
        } catch (error) {
            console.warn('Failed to get database query time:', error);
        }
        return 0;
    }

    /**
     * Store baseline metrics
     */
    private async storeBaseline(baseline: BenchmarkMetrics): Promise<void> {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/benchmarks/baseline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(baseline)
            });
        } catch (error) {
            console.warn('Failed to store baseline:', error);
        }
    }

    /**
     * Store benchmark results
     */
    private async storeResults(results: BenchmarkResult[]): Promise<void> {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/benchmarks/results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(results)
            });
        } catch (error) {
            console.warn('Failed to store results:', error);
        }
    }

    /**
     * Get stored baseline metrics
     */
    async getBaseline(): Promise<BenchmarkMetrics | null> {
        if (this.baselineMetrics) {
            return this.baselineMetrics;
        }

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/benchmarks/baseline`);
            if (response.ok) {
                this.baselineMetrics = await response.json();
                return this.baselineMetrics;
            }
        } catch (error) {
            console.warn('Failed to get baseline:', error);
        }

        return null;
    }

    /**
     * Get test results
     */
    getResults(): BenchmarkResult[] {
        return this.testResults;
    }
}

// Export singleton instance
export const performanceBenchmarker = new PerformanceBenchmarker();

// Export class for direct instantiation if needed
export { PerformanceBenchmarker };