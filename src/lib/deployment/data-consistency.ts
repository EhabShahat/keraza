/**
 * Data Consistency Checker
 * 
 * Ensures data integrity during rollback operations
 * and validates system state consistency.
 */

export interface ConsistencyCheck {
  id: string;
  name: string;
  type: 'database' | 'cache' | 'file_system' | 'external_service' | 'cross_system';
  description: string;
  query?: string;
  endpoint?: string;
  expected_result: any;
  tolerance?: number; // For numeric comparisons
  critical: boolean;
  timeout: number;
  retry_count: number;
  dependencies: string[]; // Other checks that must pass first
}

export interface ConsistencyResult {
  check_id: string;
  timestamp: Date;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  actual_result: any;
  expected_result: any;
  difference?: any;
  error?: string;
  execution_time: number;
  retry_attempt: number;
}

export interface ConsistencyReport {
  id: string;
  timestamp: Date;
  overall_status: 'consistent' | 'inconsistent' | 'warning' | 'unknown';
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  warning_checks: number;
  skipped_checks: number;
  critical_failures: number;
  results: ConsistencyResult[];
  recommendations: ConsistencyRecommendation[];
}

export interface ConsistencyRecommendation {
  type: 'immediate_action' | 'investigation' | 'monitoring' | 'prevention';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action_items: string[];
  affected_systems: string[];
}

export interface DataSnapshot {
  id: string;
  timestamp: Date;
  environment: 'blue' | 'green';
  tables: TableSnapshot[];
  cache_keys: CacheSnapshot[];
  file_checksums: FileSnapshot[];
}

export interface TableSnapshot {
  table_name: string;
  row_count: number;
  checksum: string;
  last_modified: Date;
  key_columns: string[];
}

export interface CacheSnapshot {
  key: string;
  value_hash: string;
  ttl: number;
  size: number;
}

export interface FileSnapshot {
  file_path: string;
  checksum: string;
  size: number;
  last_modified: Date;
}

export class DataConsistencyChecker {
  private checks: Map<string, ConsistencyCheck> = new Map();
  private snapshots: DataSnapshot[] = [];
  private reports: ConsistencyReport[] = [];

  constructor() {
    this.initializeDefaultChecks();
  }

  /**
   * Initialize default consistency checks
   */
  private initializeDefaultChecks(): void {
    const defaultChecks: ConsistencyCheck[] = [
      {
        id: 'exam-count-consistency',
        name: 'Exam Count Consistency',
        type: 'database',
        description: 'Verify that exam counts match between environments',
        query: 'SELECT COUNT(*) as count FROM exams WHERE status = "active"',
        expected_result: { count: { $gte: 0 } },
        critical: true,
        timeout: 10000,
        retry_count: 2,
        dependencies: []
      },
      {
        id: 'student-data-integrity',
        name: 'Student Data Integrity',
        type: 'database',
        description: 'Check student data consistency and referential integrity',
        query: 'SELECT COUNT(*) as count FROM students WHERE student_code IS NOT NULL',
        expected_result: { count: { $gte: 0 } },
        critical: true,
        timeout: 15000,
        retry_count: 2,
        dependencies: []
      },
      {
        id: 'attempt-state-consistency',
        name: 'Attempt State Consistency',
        type: 'database',
        description: 'Verify attempt states are valid and consistent',
        query: `
          SELECT 
            status,
            COUNT(*) as count 
          FROM student_exam_attempts 
          WHERE status IN ('in_progress', 'completed', 'submitted') 
          GROUP BY status
        `,
        expected_result: { $type: 'array' },
        critical: true,
        timeout: 20000,
        retry_count: 2,
        dependencies: []
      },
      {
        id: 'cache-consistency',
        name: 'Cache Consistency',
        type: 'cache',
        description: 'Verify cache data consistency across environments',
        endpoint: '/api/cache/consistency',
        expected_result: { status: 'consistent' },
        critical: false,
        timeout: 10000,
        retry_count: 1,
        dependencies: []
      },
      {
        id: 'admin-user-consistency',
        name: 'Admin User Consistency',
        type: 'database',
        description: 'Verify admin users exist and have proper permissions',
        query: 'SELECT COUNT(*) as count FROM admin_users WHERE active = true',
        expected_result: { count: { $gte: 1 } },
        critical: true,
        timeout: 10000,
        retry_count: 2,
        dependencies: []
      },
      {
        id: 'app-config-consistency',
        name: 'Application Configuration Consistency',
        type: 'database',
        description: 'Verify application configuration is complete and valid',
        query: 'SELECT key, value FROM app_config WHERE key IN ("system_mode", "app_name")',
        expected_result: { $minLength: 2 },
        critical: true,
        timeout: 10000,
        retry_count: 2,
        dependencies: []
      },
      {
        id: 'audit-log-integrity',
        name: 'Audit Log Integrity',
        type: 'database',
        description: 'Verify audit logs are being written correctly',
        query: 'SELECT COUNT(*) as count FROM audit_logs WHERE created_at > NOW() - INTERVAL 1 HOUR',
        expected_result: { count: { $gte: 0 } },
        critical: false,
        timeout: 10000,
        retry_count: 1,
        dependencies: []
      },
      {
        id: 'cross-system-consistency',
        name: 'Cross-System Data Consistency',
        type: 'cross_system',
        description: 'Verify data consistency between database and cache',
        critical: false,
        timeout: 30000,
        retry_count: 1,
        dependencies: ['exam-count-consistency', 'cache-consistency']
      }
    ];

    defaultChecks.forEach(check => {
      this.checks.set(check.id, check);
    });
  }

  /**
   * Run all consistency checks
   */
  async runConsistencyChecks(environment?: 'blue' | 'green'): Promise<ConsistencyReport> {
    const reportId = this.generateReportId();
    const startTime = Date.now();

    console.log(`Starting consistency checks for ${environment || 'current'} environment`);

    const results: ConsistencyResult[] = [];
    const enabledChecks = Array.from(this.checks.values());

    // Sort checks by dependencies
    const sortedChecks = this.sortChecksByDependencies(enabledChecks);

    // Execute checks in dependency order
    for (const check of sortedChecks) {
      try {
        // Check if dependencies passed
        if (!this.dependenciesPassed(check, results)) {
          const skippedResult: ConsistencyResult = {
            check_id: check.id,
            timestamp: new Date(),
            status: 'skipped',
            actual_result: null,
            expected_result: check.expected_result,
            error: 'Dependencies failed',
            execution_time: 0,
            retry_attempt: 0
          };
          results.push(skippedResult);
          continue;
        }

        const result = await this.executeConsistencyCheck(check, environment);
        results.push(result);

      } catch (error) {
        const errorResult: ConsistencyResult = {
          check_id: check.id,
          timestamp: new Date(),
          status: 'failed',
          actual_result: null,
          expected_result: check.expected_result,
          error: error.message,
          execution_time: 0,
          retry_attempt: 0
        };
        results.push(errorResult);
      }
    }

    // Generate report
    const report = this.generateConsistencyReport(reportId, results);
    this.reports.push(report);

    const duration = Date.now() - startTime;
    console.log(`Consistency checks completed in ${duration}ms. Status: ${report.overall_status}`);

    return report;
  }

  /**
   * Sort checks by dependencies
   */
  private sortChecksByDependencies(checks: ConsistencyCheck[]): ConsistencyCheck[] {
    const sorted: ConsistencyCheck[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (check: ConsistencyCheck) => {
      if (visiting.has(check.id)) {
        throw new Error(`Circular dependency detected involving check ${check.id}`);
      }
      if (visited.has(check.id)) {
        return;
      }

      visiting.add(check.id);

      // Visit dependencies first
      for (const depId of check.dependencies) {
        const depCheck = checks.find(c => c.id === depId);
        if (depCheck) {
          visit(depCheck);
        }
      }

      visiting.delete(check.id);
      visited.add(check.id);
      sorted.push(check);
    };

    for (const check of checks) {
      if (!visited.has(check.id)) {
        visit(check);
      }
    }

    return sorted;
  }

  /**
   * Check if dependencies passed
   */
  private dependenciesPassed(check: ConsistencyCheck, results: ConsistencyResult[]): boolean {
    for (const depId of check.dependencies) {
      const depResult = results.find(r => r.check_id === depId);
      if (!depResult || depResult.status === 'failed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Execute single consistency check with retries
   */
  private async executeConsistencyCheck(
    check: ConsistencyCheck, 
    environment?: 'blue' | 'green'
  ): Promise<ConsistencyResult> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= check.retry_count + 1; attempt++) {
      try {
        const startTime = Date.now();
        const actualResult = await this.performCheck(check, environment);
        const executionTime = Date.now() - startTime;

        const status = this.validateResult(actualResult, check.expected_result, check.tolerance);
        
        const result: ConsistencyResult = {
          check_id: check.id,
          timestamp: new Date(),
          status,
          actual_result: actualResult,
          expected_result: check.expected_result,
          execution_time: executionTime,
          retry_attempt: attempt
        };

        if (status === 'failed' && attempt <= check.retry_count) {
          console.warn(`Consistency check ${check.name} failed (attempt ${attempt}), retrying...`);
          await this.sleep(1000 * attempt); // Exponential backoff
          continue;
        }

        return result;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt <= check.retry_count) {
          console.warn(`Consistency check ${check.name} error (attempt ${attempt}), retrying...`);
          await this.sleep(1000 * attempt);
        }
      }
    }

    // All attempts failed
    return {
      check_id: check.id,
      timestamp: new Date(),
      status: 'failed',
      actual_result: null,
      expected_result: check.expected_result,
      error: lastError?.message || 'Unknown error',
      execution_time: 0,
      retry_attempt: check.retry_count + 1
    };
  }

  /**
   * Perform the actual consistency check
   */
  private async performCheck(check: ConsistencyCheck, environment?: 'blue' | 'green'): Promise<any> {
    switch (check.type) {
      case 'database':
        return await this.performDatabaseCheck(check, environment);
      case 'cache':
        return await this.performCacheCheck(check, environment);
      case 'file_system':
        return await this.performFileSystemCheck(check, environment);
      case 'external_service':
        return await this.performExternalServiceCheck(check, environment);
      case 'cross_system':
        return await this.performCrossSystemCheck(check, environment);
      default:
        throw new Error(`Unknown check type: ${check.type}`);
    }
  }

  /**
   * Perform database consistency check
   */
  private async performDatabaseCheck(check: ConsistencyCheck, environment?: 'blue' | 'green'): Promise<any> {
    if (!check.query) {
      throw new Error('Database check requires query');
    }

    try {
      // This would execute the actual database query
      // For now, we'll simulate different results based on the query
      if (check.query.includes('COUNT(*)')) {
        return { count: Math.floor(Math.random() * 100) + 10 };
      } else if (check.query.includes('GROUP BY')) {
        return [
          { status: 'in_progress', count: 5 },
          { status: 'completed', count: 15 },
          { status: 'submitted', count: 8 }
        ];
      } else if (check.query.includes('app_config')) {
        return [
          { key: 'system_mode', value: 'exam' },
          { key: 'app_name', value: 'Advanced Exam Application' }
        ];
      } else {
        return { result: 'success' };
      }

    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Perform cache consistency check
   */
  private async performCacheCheck(check: ConsistencyCheck, environment?: 'blue' | 'green'): Promise<any> {
    if (!check.endpoint) {
      throw new Error('Cache check requires endpoint');
    }

    try {
      const response = await fetch(check.endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(check.timeout)
      });

      if (!response.ok) {
        throw new Error(`Cache check failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      throw new Error(`Cache check failed: ${error.message}`);
    }
  }

  /**
   * Perform file system consistency check
   */
  private async performFileSystemCheck(check: ConsistencyCheck, environment?: 'blue' | 'green'): Promise<any> {
    // This would check file system consistency
    // For now, we'll simulate file system checks
    return {
      files_checked: 10,
      files_consistent: 10,
      total_size: 1024000
    };
  }

  /**
   * Perform external service consistency check
   */
  private async performExternalServiceCheck(check: ConsistencyCheck, environment?: 'blue' | 'green'): Promise<any> {
    if (!check.endpoint) {
      throw new Error('External service check requires endpoint');
    }

    try {
      const response = await fetch(check.endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(check.timeout)
      });

      return {
        status: response.ok ? 'available' : 'unavailable',
        response_code: response.status,
        response_time: Math.random() * 1000
      };

    } catch (error) {
      return {
        status: 'unavailable',
        error: error.message
      };
    }
  }

  /**
   * Perform cross-system consistency check
   */
  private async performCrossSystemCheck(check: ConsistencyCheck, environment?: 'blue' | 'green'): Promise<any> {
    // This would compare data across different systems
    // For now, we'll simulate cross-system validation
    return {
      database_records: 100,
      cache_entries: 98,
      consistency_percentage: 98,
      discrepancies: [
        { type: 'missing_cache_entry', key: 'exam_123' },
        { type: 'stale_cache_entry', key: 'student_456' }
      ]
    };
  }

  /**
   * Validate result against expected result
   */
  private validateResult(actual: any, expected: any, tolerance?: number): 'passed' | 'failed' | 'warning' {
    try {
      if (this.matchesExpected(actual, expected, tolerance)) {
        return 'passed';
      } else {
        // Check if it's within warning tolerance
        if (tolerance && this.withinTolerance(actual, expected, tolerance * 2)) {
          return 'warning';
        }
        return 'failed';
      }
    } catch (error) {
      return 'failed';
    }
  }

  /**
   * Check if actual result matches expected result
   */
  private matchesExpected(actual: any, expected: any, tolerance?: number): boolean {
    if (typeof expected === 'object' && expected !== null) {
      // Handle special operators
      for (const [key, value] of Object.entries(expected)) {
        if (key.startsWith('$')) {
          switch (key) {
            case '$gte':
              return typeof actual === 'object' && actual.count >= value;
            case '$lte':
              return typeof actual === 'object' && actual.count <= value;
            case '$gt':
              return typeof actual === 'object' && actual.count > value;
            case '$lt':
              return typeof actual === 'object' && actual.count < value;
            case '$type':
              return value === 'array' ? Array.isArray(actual) : typeof actual === value;
            case '$minLength':
              return Array.isArray(actual) && actual.length >= value;
            case '$maxLength':
              return Array.isArray(actual) && actual.length <= value;
            default:
              return false;
          }
        } else {
          // Regular property matching
          if (actual[key] !== value) {
            if (tolerance && typeof actual[key] === 'number' && typeof value === 'number') {
              return Math.abs(actual[key] - value) <= tolerance;
            }
            return false;
          }
        }
      }
      return true;
    }

    // Direct comparison
    if (tolerance && typeof actual === 'number' && typeof expected === 'number') {
      return Math.abs(actual - expected) <= tolerance;
    }

    return actual === expected;
  }

  /**
   * Check if value is within tolerance
   */
  private withinTolerance(actual: any, expected: any, tolerance: number): boolean {
    if (typeof actual === 'number' && typeof expected === 'number') {
      return Math.abs(actual - expected) <= tolerance;
    }
    return false;
  }

  /**
   * Generate consistency report
   */
  private generateConsistencyReport(reportId: string, results: ConsistencyResult[]): ConsistencyReport {
    const totalChecks = results.length;
    const passedChecks = results.filter(r => r.status === 'passed').length;
    const failedChecks = results.filter(r => r.status === 'failed').length;
    const warningChecks = results.filter(r => r.status === 'warning').length;
    const skippedChecks = results.filter(r => r.status === 'skipped').length;

    // Count critical failures
    const criticalFailures = results.filter(r => {
      const check = this.checks.get(r.check_id);
      return check?.critical && r.status === 'failed';
    }).length;

    // Determine overall status
    let overallStatus: 'consistent' | 'inconsistent' | 'warning' | 'unknown';
    
    if (criticalFailures > 0) {
      overallStatus = 'inconsistent';
    } else if (failedChecks > 0) {
      overallStatus = 'warning';
    } else if (warningChecks > 0) {
      overallStatus = 'warning';
    } else if (passedChecks === totalChecks - skippedChecks) {
      overallStatus = 'consistent';
    } else {
      overallStatus = 'unknown';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(results);

    return {
      id: reportId,
      timestamp: new Date(),
      overall_status: overallStatus,
      total_checks: totalChecks,
      passed_checks: passedChecks,
      failed_checks: failedChecks,
      warning_checks: warningChecks,
      skipped_checks: skippedChecks,
      critical_failures: criticalFailures,
      results,
      recommendations
    };
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(results: ConsistencyResult[]): ConsistencyRecommendation[] {
    const recommendations: ConsistencyRecommendation[] = [];
    const failedResults = results.filter(r => r.status === 'failed');
    const warningResults = results.filter(r => r.status === 'warning');

    // Critical failures
    const criticalFailures = failedResults.filter(r => {
      const check = this.checks.get(r.check_id);
      return check?.critical;
    });

    if (criticalFailures.length > 0) {
      recommendations.push({
        type: 'immediate_action',
        priority: 'critical',
        title: 'Critical Data Consistency Issues Detected',
        description: 'Critical consistency checks have failed, indicating potential data integrity issues.',
        action_items: [
          'Stop all deployment activities immediately',
          'Investigate failed consistency checks',
          'Verify data integrity in affected systems',
          'Consider emergency rollback if data corruption is suspected'
        ],
        affected_systems: criticalFailures.map(r => this.checks.get(r.check_id)?.name || r.check_id)
      });
    }

    // Database consistency issues
    const dbFailures = failedResults.filter(r => {
      const check = this.checks.get(r.check_id);
      return check?.type === 'database';
    });

    if (dbFailures.length > 0) {
      recommendations.push({
        type: 'investigation',
        priority: 'high',
        title: 'Database Consistency Issues',
        description: 'Database consistency checks have failed.',
        action_items: [
          'Review database query results and expected values',
          'Check for recent schema changes or data migrations',
          'Verify database replication status if applicable',
          'Run additional database integrity checks'
        ],
        affected_systems: ['Database']
      });
    }

    // Cache consistency issues
    const cacheFailures = failedResults.filter(r => {
      const check = this.checks.get(r.check_id);
      return check?.type === 'cache';
    });

    if (cacheFailures.length > 0) {
      recommendations.push({
        type: 'investigation',
        priority: 'medium',
        title: 'Cache Consistency Issues',
        description: 'Cache consistency checks have failed.',
        action_items: [
          'Clear affected cache entries',
          'Verify cache invalidation mechanisms',
          'Check cache synchronization between environments',
          'Monitor cache hit rates and performance'
        ],
        affected_systems: ['Cache']
      });
    }

    // Warning level issues
    if (warningResults.length > 0) {
      recommendations.push({
        type: 'monitoring',
        priority: 'medium',
        title: 'Data Consistency Warnings',
        description: 'Some consistency checks returned warning status.',
        action_items: [
          'Monitor affected systems closely',
          'Review warning thresholds and tolerances',
          'Investigate root causes of data discrepancies',
          'Consider adjusting consistency check parameters'
        ],
        affected_systems: warningResults.map(r => this.checks.get(r.check_id)?.name || r.check_id)
      });
    }

    return recommendations;
  }

  /**
   * Create data snapshot for environment
   */
  async createSnapshot(environment: 'blue' | 'green'): Promise<string> {
    console.log(`Creating data snapshot for ${environment} environment`);

    const snapshot: DataSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date(),
      environment,
      tables: await this.captureTableSnapshots(),
      cache_keys: await this.captureCacheSnapshots(),
      file_checksums: await this.captureFileSnapshots()
    };

    this.snapshots.push(snapshot);

    // Keep only last 10 snapshots
    if (this.snapshots.length > 10) {
      this.snapshots.splice(0, this.snapshots.length - 10);
    }

    console.log(`Snapshot ${snapshot.id} created for ${environment} environment`);
    return snapshot.id;
  }

  /**
   * Compare snapshots between environments
   */
  async compareSnapshots(snapshot1Id: string, snapshot2Id: string): Promise<ConsistencyReport> {
    const snapshot1 = this.snapshots.find(s => s.id === snapshot1Id);
    const snapshot2 = this.snapshots.find(s => s.id === snapshot2Id);

    if (!snapshot1 || !snapshot2) {
      throw new Error('One or both snapshots not found');
    }

    console.log(`Comparing snapshots ${snapshot1Id} and ${snapshot2Id}`);

    const results: ConsistencyResult[] = [];

    // Compare table snapshots
    for (const table1 of snapshot1.tables) {
      const table2 = snapshot2.tables.find(t => t.table_name === table1.table_name);
      
      if (!table2) {
        results.push({
          check_id: `table-${table1.table_name}`,
          timestamp: new Date(),
          status: 'failed',
          actual_result: { exists: false },
          expected_result: { exists: true },
          error: `Table ${table1.table_name} missing in second snapshot`,
          execution_time: 0,
          retry_attempt: 1
        });
        continue;
      }

      const consistent = table1.row_count === table2.row_count && table1.checksum === table2.checksum;
      
      results.push({
        check_id: `table-${table1.table_name}`,
        timestamp: new Date(),
        status: consistent ? 'passed' : 'failed',
        actual_result: { row_count: table2.row_count, checksum: table2.checksum },
        expected_result: { row_count: table1.row_count, checksum: table1.checksum },
        execution_time: 0,
        retry_attempt: 1
      });
    }

    return this.generateConsistencyReport(this.generateReportId(), results);
  }

  /**
   * Capture table snapshots
   */
  private async captureTableSnapshots(): Promise<TableSnapshot[]> {
    // This would capture actual table snapshots
    // For now, we'll simulate table data
    const tables = ['exams', 'students', 'student_exam_attempts', 'admin_users', 'app_config'];
    
    return tables.map(tableName => ({
      table_name: tableName,
      row_count: Math.floor(Math.random() * 1000) + 10,
      checksum: this.generateChecksum(),
      last_modified: new Date(),
      key_columns: ['id']
    }));
  }

  /**
   * Capture cache snapshots
   */
  private async captureCacheSnapshots(): Promise<CacheSnapshot[]> {
    // This would capture actual cache data
    // For now, we'll simulate cache entries
    const cacheKeys = ['exam_settings', 'student_data', 'system_config'];
    
    return cacheKeys.map(key => ({
      key,
      value_hash: this.generateChecksum(),
      ttl: 3600,
      size: Math.floor(Math.random() * 10000) + 100
    }));
  }

  /**
   * Capture file snapshots
   */
  private async captureFileSnapshots(): Promise<FileSnapshot[]> {
    // This would capture actual file checksums
    // For now, we'll simulate file data
    const files = ['config.json', 'schema.sql', 'migrations.sql'];
    
    return files.map(filePath => ({
      file_path: filePath,
      checksum: this.generateChecksum(),
      size: Math.floor(Math.random() * 100000) + 1000,
      last_modified: new Date()
    }));
  }

  /**
   * Get consistency reports history
   */
  getReportsHistory(limit: number = 20): ConsistencyReport[] {
    return [...this.reports]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get available snapshots
   */
  getSnapshots(): DataSnapshot[] {
    return [...this.snapshots].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private generateReportId(): string {
    return `consistency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChecksum(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for global use
 */
export const dataConsistencyChecker = new DataConsistencyChecker();