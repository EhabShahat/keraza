#!/usr/bin/env node

/**
 * Database Monitoring Setup Validation Script
 * Validates that all monitoring components are properly configured
 */

const fs = require('fs');
const path = require('path');

class MonitoringValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = [];
  }

  /**
   * Run all validation checks
   */
  async validate() {
    console.log('🔍 Validating database monitoring setup...\n');

    // File structure checks
    this.checkFileStructure();
    
    // Component checks
    this.checkComponents();
    
    // Configuration checks
    this.checkConfiguration();
    
    // API endpoint checks
    this.checkAPIEndpoints();
    
    // Script checks
    this.checkScripts();
    
    // Display results
    this.displayResults();
    
    return this.errors.length === 0;
  }

  /**
   * Check file structure
   */
  checkFileStructure() {
    console.log('📁 Checking file structure...');

    const requiredFiles = [
      'src/lib/database/performance-monitor.ts',
      'src/lib/database/performance-alerting.ts',
      'src/lib/database/automated-tuning.ts',
      'src/lib/database/query-optimizer.ts',
      'src/components/DatabaseHealthDashboard.tsx',
      'src/app/api/admin/database/performance/route.ts',
      'src/app/api/admin/database/tuning/route.ts',
      'scripts/setup-database-monitoring.js',
      'scripts/database-health-check.js',
      'scripts/test-database-monitoring.js',
      'docs/database-performance-monitoring.md'
    ];

    requiredFiles.forEach(file => {
      if (fs.existsSync(file)) {
        this.checks.push({ type: 'file', name: file, status: 'PASS' });
        console.log(`   ✅ ${file}`);
      } else {
        this.errors.push(`Missing required file: ${file}`);
        this.checks.push({ type: 'file', name: file, status: 'FAIL' });
        console.log(`   ❌ ${file}`);
      }
    });

    console.log('');
  }

  /**
   * Check component implementations
   */
  checkComponents() {
    console.log('🔧 Checking component implementations...');

    const components = [
      {
        file: 'src/lib/database/performance-monitor.ts',
        exports: ['performanceMonitor', 'PerformanceAlert', 'DatabaseHealth']
      },
      {
        file: 'src/lib/database/performance-alerting.ts',
        exports: ['alertingSystem', 'AlertRule', 'AlertChannel']
      },
      {
        file: 'src/lib/database/automated-tuning.ts',
        exports: ['automatedTuning', 'TuningRecommendation', 'AutoTuningConfig']
      },
      {
        file: 'src/lib/database/query-optimizer.ts',
        exports: ['queryOptimizer', 'QueryMetrics']
      }
    ];

    components.forEach(component => {
      if (fs.existsSync(component.file)) {
        const content = fs.readFileSync(component.file, 'utf8');
        
        component.exports.forEach(exportName => {
          if (content.includes(`export const ${exportName}`) || 
              content.includes(`export { ${exportName}`) ||
              content.includes(`export type { ${exportName}`) ||
              content.includes(`${exportName},`) ||
              content.includes(`${exportName} }`)) {
            this.checks.push({ type: 'export', name: `${component.file}:${exportName}`, status: 'PASS' });
            console.log(`   ✅ ${exportName} exported from ${path.basename(component.file)}`);
          } else {
            this.errors.push(`Missing export ${exportName} in ${component.file}`);
            this.checks.push({ type: 'export', name: `${component.file}:${exportName}`, status: 'FAIL' });
            console.log(`   ❌ ${exportName} missing from ${path.basename(component.file)}`);
          }
        });
      }
    });

    console.log('');
  }

  /**
   * Check configuration
   */
  checkConfiguration() {
    console.log('⚙️ Checking configuration...');

    // Check package.json scripts
    if (fs.existsSync('package.json')) {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const requiredScripts = [
        'setup:monitoring',
        'test:monitoring',
        'health:check'
      ];

      requiredScripts.forEach(script => {
        if (packageJson.scripts && packageJson.scripts[script]) {
          this.checks.push({ type: 'script', name: script, status: 'PASS' });
          console.log(`   ✅ Script: ${script}`);
        } else {
          this.warnings.push(`Missing package.json script: ${script}`);
          this.checks.push({ type: 'script', name: script, status: 'WARN' });
          console.log(`   ⚠️ Script: ${script}`);
        }
      });
    }

    // Check environment variables documentation
    if (fs.existsSync('.env.local.example')) {
      const envExample = fs.readFileSync('.env.local.example', 'utf8');
      
      const monitoringVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY'
      ];

      monitoringVars.forEach(envVar => {
        if (envExample.includes(envVar)) {
          this.checks.push({ type: 'env', name: envVar, status: 'PASS' });
          console.log(`   ✅ Environment variable documented: ${envVar}`);
        } else {
          this.warnings.push(`Environment variable not documented: ${envVar}`);
          this.checks.push({ type: 'env', name: envVar, status: 'WARN' });
          console.log(`   ⚠️ Environment variable not documented: ${envVar}`);
        }
      });
    }

    console.log('');
  }

  /**
   * Check API endpoints
   */
  checkAPIEndpoints() {
    console.log('🌐 Checking API endpoints...');

    const apiEndpoints = [
      {
        file: 'src/app/api/admin/database/performance/route.ts',
        methods: ['GET', 'POST']
      },
      {
        file: 'src/app/api/admin/database/tuning/route.ts',
        methods: ['GET', 'POST']
      }
    ];

    apiEndpoints.forEach(endpoint => {
      if (fs.existsSync(endpoint.file)) {
        const content = fs.readFileSync(endpoint.file, 'utf8');
        
        endpoint.methods.forEach(method => {
          if (content.includes(`export async function ${method}`)) {
            this.checks.push({ type: 'api', name: `${endpoint.file}:${method}`, status: 'PASS' });
            console.log(`   ✅ ${method} method in ${path.basename(endpoint.file)}`);
          } else {
            this.errors.push(`Missing ${method} method in ${endpoint.file}`);
            this.checks.push({ type: 'api', name: `${endpoint.file}:${method}`, status: 'FAIL' });
            console.log(`   ❌ ${method} method missing in ${path.basename(endpoint.file)}`);
          }
        });
      }
    });

    console.log('');
  }

  /**
   * Check scripts
   */
  checkScripts() {
    console.log('📜 Checking scripts...');

    const scripts = [
      'scripts/setup-database-monitoring.js',
      'scripts/database-health-check.js',
      'scripts/test-database-monitoring.js'
    ];

    scripts.forEach(script => {
      if (fs.existsSync(script)) {
        const content = fs.readFileSync(script, 'utf8');
        
        // Check for main execution
        if (content.includes('if (require.main === module)')) {
          this.checks.push({ type: 'script-exec', name: script, status: 'PASS' });
          console.log(`   ✅ ${path.basename(script)} - executable`);
        } else {
          this.warnings.push(`Script ${script} may not be executable`);
          this.checks.push({ type: 'script-exec', name: script, status: 'WARN' });
          console.log(`   ⚠️ ${path.basename(script)} - may not be executable`);
        }

        // Check for error handling
        if (content.includes('try') && content.includes('catch')) {
          this.checks.push({ type: 'script-error', name: script, status: 'PASS' });
          console.log(`   ✅ ${path.basename(script)} - has error handling`);
        } else {
          this.warnings.push(`Script ${script} may lack error handling`);
          this.checks.push({ type: 'script-error', name: script, status: 'WARN' });
          console.log(`   ⚠️ ${path.basename(script)} - may lack error handling`);
        }
      }
    });

    console.log('');
  }

  /**
   * Display validation results
   */
  displayResults() {
    console.log('='.repeat(60));
    console.log('📋 MONITORING SETUP VALIDATION RESULTS');
    console.log('='.repeat(60));

    const passed = this.checks.filter(c => c.status === 'PASS').length;
    const failed = this.checks.filter(c => c.status === 'FAIL').length;
    const warned = this.checks.filter(c => c.status === 'WARN').length;

    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warned}`);
    console.log(`📊 Total: ${this.checks.length}`);

    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      this.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    if (this.errors.length === 0) {
      console.log('🎉 Monitoring setup validation passed!');
      console.log('\n📋 Next steps:');
      console.log('   1. Set up environment variables (.env.local)');
      console.log('   2. Run: npm run setup:monitoring');
      console.log('   3. Run: npm run test:monitoring');
      console.log('   4. Access monitoring dashboard in admin panel');
    } else {
      console.log('⚠️ Monitoring setup has issues that need to be resolved.');
      console.log('\n🔧 Please fix the errors above and run validation again.');
    }
    
    console.log('='.repeat(60) + '\n');

    // Summary by category
    console.log('📊 Summary by Category:');
    const categories = {};
    this.checks.forEach(check => {
      if (!categories[check.type]) {
        categories[check.type] = { pass: 0, fail: 0, warn: 0 };
      }
      categories[check.type][check.status.toLowerCase()]++;
    });

    Object.entries(categories).forEach(([type, counts]) => {
      console.log(`   ${type}: ${counts.pass} passed, ${counts.fail} failed, ${counts.warn} warnings`);
    });

    console.log('');
  }
}

// Main execution
async function main() {
  try {
    const validator = new MonitoringValidator();
    const success = await validator.validate();
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { MonitoringValidator };