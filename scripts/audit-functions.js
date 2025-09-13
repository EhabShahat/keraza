#!/usr/bin/env node

const { FunctionAnalyzer } = require('../src/lib/audit/function-analyzer.ts');
const { PerformanceMonitor } = require('../src/lib/audit/performance-monitor.ts');
const { FunctionRegistry } = require('../src/lib/audit/function-registry.ts');
const path = require('path');
const fs = require('fs').promises;

async function main() {
  console.log('🚀 Starting Function Analysis and Baseline Setup...\n');
  
  try {
    // Initialize analyzer, monitor, and registry
    const analyzer = new FunctionAnalyzer();
    const monitor = new PerformanceMonitor();
    const registry = new FunctionRegistry();
    
    // Step 1: Scan all API routes
    console.log('📊 Step 1: Scanning API routes...');
    const routes = await analyzer.scanRoutes();
    
    // Step 2: Generate metrics
    console.log('\n📈 Step 2: Generating metrics...');
    const metrics = analyzer.generateMetrics();
    
    console.log(`\n📋 Analysis Results:`);
    console.log(`   Total Routes: ${metrics.totalRoutes}`);
    console.log(`   By Category:`);
    Object.entries(metrics.routesByCategory).forEach(([category, count]) => {
      console.log(`     ${category}: ${count}`);
    });
    console.log(`   By Complexity:`);
    Object.entries(metrics.routesByComplexity).forEach(([complexity, count]) => {
      console.log(`     ${complexity}: ${count}`);
    });
    console.log(`   Consolidation Candidates: ${metrics.consolidationCandidates}`);
    console.log(`   Total File Size: ${(metrics.totalFileSize / 1024).toFixed(2)} KB`);
    
    // Step 3: Generate consolidation recommendations
    console.log('\n🎯 Step 3: Generating consolidation recommendations...');
    const recommendations = analyzer.generateConsolidationRecommendations();
    
    console.log(`\n💡 Consolidation Recommendations:`);
    recommendations.forEach(rec => {
      console.log(`   ${rec.category}: ${rec.routes.length} routes → 1 handler (saves ${rec.estimatedSavings} functions)`);
    });
    
    // Step 4: Simulate performance baseline
    console.log('\n⚡ Step 4: Establishing performance baseline...');
    const functionNames = routes.map(route => route.id);
    const baseline = await monitor.simulateBaseline(functionNames);
    
    console.log(`\n📊 Performance Baseline:`);
    console.log(`   Total Functions: ${baseline.totalFunctions}`);
    console.log(`   Average Response Time: ${baseline.averageResponseTime.toFixed(2)}ms`);
    console.log(`   Memory Usage: ${(baseline.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Error Rate: ${baseline.errorRate.toFixed(2)}%`);
    console.log(`   Consolidation Potential: ${baseline.consolidationPotential.toFixed(1)}%`);
    
    // Step 5: Register functions in database
    console.log('\n📝 Step 5: Registering functions in database...');
    
    try {
      const functionsToRegister = routes.map(route => ({
        name: route.id,
        original_path: route.path,
        category: route.category,
        http_methods: route.methods,
        dependencies: route.dependencies,
        estimated_complexity: route.estimatedComplexity,
        consolidation_candidate: route.consolidationCandidate,
        file_size: route.fileSize
      }));
      
      await registry.bulkRegisterFunctions(functionsToRegister);
      
      // Record initial performance baseline
      await registry.recordPerformanceBaseline({
        baseline_type: 'initial',
        total_functions: baseline.totalFunctions,
        avg_response_time_ms: baseline.averageResponseTime,
        memory_usage_mb: baseline.memoryUsage.heapUsed / (1024 * 1024),
        error_rate_percent: baseline.errorRate,
        throughput_rpm: baseline.throughput || 0,
        consolidation_potential_percent: baseline.consolidationPotential,
        notes: 'Initial baseline established by function analyzer'
      });
      
      console.log('✅ Functions registered in database');
    } catch (dbError) {
      console.warn('⚠️  Could not register functions in database:', dbError.message);
      console.log('📄 Continuing with file export...');
    }
    
    // Step 6: Export results
    console.log('\n💾 Step 6: Exporting results...');
    
    // Create audit directory if it doesn't exist
    const auditDir = path.join(process.cwd(), 'audit-results');
    try {
      await fs.mkdir(auditDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Export analysis
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const analysisPath = path.join(auditDir, `function-analysis-${timestamp}.json`);
    await analyzer.exportAnalysis(analysisPath);
    
    // Export performance metrics
    const metricsPath = path.join(auditDir, `performance-baseline-${timestamp}.json`);
    await monitor.exportMetrics(metricsPath);
    
    // Generate summary report
    const summaryPath = path.join(auditDir, `audit-summary-${timestamp}.md`);
    await generateSummaryReport(summaryPath, {
      routes,
      metrics,
      recommendations,
      baseline,
      timestamp: new Date()
    });
    
    console.log(`\n✅ Analysis complete! Results saved to:`);
    console.log(`   📄 Analysis: ${analysisPath}`);
    console.log(`   📊 Metrics: ${metricsPath}`);
    console.log(`   📋 Summary: ${summaryPath}`);
    
    // Display next steps
    console.log(`\n🎯 Next Steps:`);
    console.log(`   1. Review the generated reports`);
    console.log(`   2. Access the optimization dashboard at /admin/optimization`);
    console.log(`   3. Begin consolidation with highest-impact categories`);
    console.log(`   4. Set up continuous monitoring and alerts`);
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    process.exit(1);
  }
}

async function generateSummaryReport(filePath, data) {
  const { routes, metrics, recommendations, baseline, timestamp } = data;
  
  const report = `# Function Analysis Summary

**Generated:** ${timestamp.toISOString()}

## Overview

This report provides a comprehensive analysis of the current API function structure and establishes baseline metrics for the optimization process.

## Current State

### Function Count
- **Total Routes:** ${metrics.totalRoutes}
- **Consolidation Candidates:** ${metrics.consolidationCandidates} (${((metrics.consolidationCandidates / metrics.totalRoutes) * 100).toFixed(1)}%)

### Distribution by Category
${Object.entries(metrics.routesByCategory).map(([category, count]) => 
  `- **${category}:** ${count} routes`
).join('\n')}

### Distribution by Complexity
${Object.entries(metrics.routesByComplexity).map(([complexity, count]) => 
  `- **${complexity}:** ${count} routes`
).join('\n')}

## Performance Baseline

- **Average Response Time:** ${baseline.averageResponseTime.toFixed(2)}ms
- **Memory Usage:** ${(baseline.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
- **Error Rate:** ${baseline.errorRate.toFixed(2)}%
- **Estimated Cold Start Time:** ${baseline.estimatedColdStartTime}ms
- **Consolidation Potential:** ${baseline.consolidationPotential.toFixed(1)}%

## Consolidation Recommendations

${recommendations.map(rec => `
### ${rec.category.toUpperCase()} Category
- **Current Functions:** ${rec.routes.length}
- **Proposed Handler:** ${rec.consolidatedName}
- **Functions Eliminated:** ${rec.estimatedSavings}
- **Routes to Consolidate:**
${rec.routes.map(route => `  - ${route.path}`).join('\n')}
`).join('\n')}

## Impact Analysis

### Before Optimization
- Total Functions: ${metrics.totalRoutes}
- Estimated Memory Usage: ${(baseline.estimatedMemoryUsage / 1024 / 1024).toFixed(2)}MB
- Cold Start Impact: ${baseline.estimatedColdStartTime}ms

### After Optimization (Projected)
- Total Functions: ~${metrics.totalRoutes - recommendations.reduce((sum, rec) => sum + rec.estimatedSavings, 0)}
- Function Reduction: ${((recommendations.reduce((sum, rec) => sum + rec.estimatedSavings, 0) / metrics.totalRoutes) * 100).toFixed(1)}%
- Expected Performance Improvement: 25-40%

## Next Steps

1. **Implement Function Registry** - Set up tracking system for consolidation progress
2. **Start with Admin Functions** - Highest consolidation potential (${metrics.routesByCategory.admin || 0} routes)
3. **Implement Caching Layer** - Reduce function invocations
4. **Set up Monitoring** - Track optimization progress
5. **Deploy Incrementally** - Use blue-green deployment strategy

## Risk Assessment

- **Low Risk:** Public API consolidation (well-defined interfaces)
- **Medium Risk:** Admin API consolidation (complex authentication)
- **High Risk:** Attempt management (real-time requirements)

## Success Metrics

- [ ] Reduce function count by 40%+ (target: <${Math.ceil(metrics.totalRoutes * 0.6)} functions)
- [ ] Improve average response time by 25%
- [ ] Maintain 100% feature parity
- [ ] Achieve zero-downtime deployment
- [ ] Establish comprehensive monitoring

---

*This analysis was generated automatically by the Function Analyzer tool.*
`;

  await fs.writeFile(filePath, report);
}

// Run the analysis
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };