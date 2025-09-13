#!/usr/bin/env node

/**
 * Migration Script for Consolidated RPC Functions
 * Helps migrate from individual RPC calls to consolidated functions
 */

const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');

/**
 * RPC function mapping from old to new consolidated functions
 */
const RPC_MIGRATIONS = {
  // Attempt operations
  'get_attempt_state': {
    newFunction: 'attempt_manager',
    operation: 'state',
    paramMapping: {
      'p_attempt_id': 'attemptId'
    }
  },
  'save_attempt': {
    newFunction: 'attempt_manager',
    operation: 'save',
    paramMapping: {
      'p_attempt_id': 'attemptId',
      'p_answers': 'answers',
      'p_auto_save_data': 'autoSaveData',
      'p_expected_version': 'expectedVersion'
    }
  },
  'submit_attempt': {
    newFunction: 'attempt_manager',
    operation: 'submit',
    paramMapping: {
      'p_attempt_id': 'attemptId'
    }
  },
  'start_attempt': {
    newFunction: 'attempt_manager',
    operation: 'start',
    paramMapping: {
      'p_exam_id': 'examId',
      'p_code': 'code',
      'p_student_name': 'studentName',
      'p_ip': 'ip'
    }
  },
  'start_attempt_v2': {
    newFunction: 'attempt_manager',
    operation: 'start',
    paramMapping: {
      'p_exam_id': 'examId',
      'p_code': 'code',
      'p_student_name': 'studentName',
      'p_ip': 'ip'
    }
  },

  // Admin operations
  'admin_list_admins': {
    newFunction: 'admin_manager',
    operation: 'list_admins',
    paramMapping: {}
  },
  'admin_add_admin_by_email': {
    newFunction: 'admin_manager',
    operation: 'add_admin',
    paramMapping: {
      'p_email': 'email'
    }
  },
  'admin_remove_admin': {
    newFunction: 'admin_manager',
    operation: 'remove_admin',
    paramMapping: {
      'p_user_id': 'userId'
    }
  },
  'admin_create_user': {
    newFunction: 'admin_manager',
    operation: 'create_user',
    paramMapping: {
      'p_username': 'username',
      'p_email': 'email',
      'p_password': 'password',
      'p_is_admin': 'additionalParams.is_admin'
    }
  },
  'regrade_exam': {
    newFunction: 'admin_manager',
    operation: 'regrade_exam',
    paramMapping: {
      'p_exam_id': 'examId'
    }
  },
  'regrade_attempt': {
    newFunction: 'admin_manager',
    operation: 'regrade_attempt',
    paramMapping: {
      'p_attempt_id': 'attemptId'
    }
  },
  'admin_reset_student_attempts': {
    newFunction: 'admin_manager',
    operation: 'reset_student_attempts',
    paramMapping: {
      'p_student_id': 'studentId',
      'p_exam_id': 'examId'
    }
  },
  'cleanup_expired_attempts': {
    newFunction: 'admin_manager',
    operation: 'cleanup_expired',
    paramMapping: {}
  },
  'admin_list_attempts': {
    newFunction: 'admin_manager',
    operation: 'list_attempts',
    paramMapping: {
      'p_exam_id': 'examId'
    }
  },

  // Student operations
  'get_student_with_attempts': {
    newFunction: 'student_manager',
    operation: 'get_with_attempts',
    paramMapping: {
      'p_code': 'code'
    }
  },

  // Monitoring operations
  'get_active_attempts_summary': {
    newFunction: 'monitoring_manager',
    operation: 'active_attempts',
    paramMapping: {}
  },
  'get_exam_analytics': {
    newFunction: 'monitoring_manager',
    operation: 'exam_analytics',
    paramMapping: {
      'p_exam_id': 'examId'
    }
  }
};

/**
 * Find all TypeScript files that might contain RPC calls
 */
async function findRPCFiles() {
  const patterns = [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts',
    '!node_modules/**'
  ];

  const files = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern);
    files.push(...matches);
  }

  return files;
}

/**
 * Analyze a file for RPC usage
 */
async function analyzeFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const rpcCalls = [];

  // Find .rpc( calls
  const rpcRegex = /\.rpc\s*\(\s*['"`]([^'"`]+)['"`]\s*,?\s*({[^}]*}|\{[\s\S]*?\})?/g;
  let match;

  while ((match = rpcRegex.exec(content)) !== null) {
    const functionName = match[1];
    const paramsStr = match[2] || '{}';
    
    rpcCalls.push({
      functionName,
      paramsStr,
      fullMatch: match[0],
      index: match.index,
      line: content.substring(0, match.index).split('\n').length
    });
  }

  return {
    filePath,
    rpcCalls,
    content
  };
}

/**
 * Generate migration suggestions for a file
 */
function generateMigrationSuggestions(fileAnalysis) {
  const suggestions = [];

  for (const rpcCall of fileAnalysis.rpcCalls) {
    const migration = RPC_MIGRATIONS[rpcCall.functionName];
    
    if (migration) {
      suggestions.push({
        line: rpcCall.line,
        oldCall: rpcCall.fullMatch,
        functionName: rpcCall.functionName,
        migration: migration,
        suggestion: generateNewRPCCall(rpcCall, migration)
      });
    }
  }

  return suggestions;
}

/**
 * Generate the new RPC call syntax
 */
function generateNewRPCCall(rpcCall, migration) {
  try {
    // Parse the parameters (simplified parsing)
    const paramsStr = rpcCall.paramsStr || '{}';
    
    // Generate new parameter object
    const newParams = [`p_operation: '${migration.operation}'`];
    
    // Map old parameters to new structure
    for (const [oldParam, newParam] of Object.entries(migration.paramMapping)) {
      if (paramsStr.includes(oldParam)) {
        // Extract the parameter value (simplified)
        const paramRegex = new RegExp(`${oldParam}\\s*:\\s*([^,}]+)`);
        const paramMatch = paramsStr.match(paramRegex);
        
        if (paramMatch) {
          const value = paramMatch[1].trim();
          
          if (newParam.includes('.')) {
            // Handle nested parameters like additionalParams.is_admin
            const [parent, child] = newParam.split('.');
            newParams.push(`${parent}: { ${child}: ${value} }`);
          } else {
            newParams.push(`${newParam}: ${value}`);
          }
        }
      }
    }

    return `.rpc('${migration.newFunction}', { ${newParams.join(', ')} })`;
  } catch (error) {
    return `// TODO: Manually migrate this call - ${error.message}`;
  }
}

/**
 * Create a migration report
 */
async function createMigrationReport(analyses) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: analyses.length,
      filesWithRPCs: analyses.filter(a => a.suggestions.length > 0).length,
      totalRPCCalls: analyses.reduce((sum, a) => sum + a.rpcCalls.length, 0),
      migratableRPCs: analyses.reduce((sum, a) => sum + a.suggestions.length, 0)
    },
    files: analyses.filter(a => a.suggestions.length > 0).map(a => ({
      filePath: a.filePath,
      rpcCallCount: a.rpcCalls.length,
      migratableCount: a.suggestions.length,
      suggestions: a.suggestions
    })),
    unmigratableFunctions: []
  };

  // Find functions that don't have migrations
  const allFunctions = new Set();
  const migratableFunctions = new Set(Object.keys(RPC_MIGRATIONS));
  
  analyses.forEach(a => {
    a.rpcCalls.forEach(call => {
      allFunctions.add(call.functionName);
    });
  });

  report.unmigratableFunctions = Array.from(allFunctions)
    .filter(func => !migratableFunctions.has(func))
    .map(func => ({
      functionName: func,
      usageCount: analyses.reduce((count, a) => 
        count + a.rpcCalls.filter(call => call.functionName === func).length, 0
      )
    }))
    .sort((a, b) => b.usageCount - a.usageCount);

  return report;
}

/**
 * Generate migration patches
 */
async function generateMigrationPatches(analyses) {
  const patches = [];

  for (const analysis of analyses) {
    if (analysis.suggestions.length === 0) continue;

    let modifiedContent = analysis.content;
    let offset = 0;

    // Sort suggestions by index (reverse order to maintain positions)
    const sortedSuggestions = analysis.suggestions.sort((a, b) => b.oldCall.index - a.oldCall.index);

    for (const suggestion of sortedSuggestions) {
      const oldCallIndex = modifiedContent.lastIndexOf(suggestion.oldCall);
      if (oldCallIndex !== -1) {
        modifiedContent = 
          modifiedContent.substring(0, oldCallIndex) +
          suggestion.suggestion +
          modifiedContent.substring(oldCallIndex + suggestion.oldCall.length);
      }
    }

    patches.push({
      filePath: analysis.filePath,
      originalContent: analysis.content,
      modifiedContent: modifiedContent,
      changes: analysis.suggestions.length
    });
  }

  return patches;
}

/**
 * Apply migration patches (dry run by default)
 */
async function applyMigrationPatches(patches, dryRun = true) {
  console.log(`${dryRun ? '🔍 DRY RUN:' : '✍️  APPLYING:'} Migration patches...\n`);

  for (const patch of patches) {
    console.log(`📄 ${patch.filePath} (${patch.changes} changes)`);
    
    if (!dryRun) {
      // Create backup
      const backupPath = `${patch.filePath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, patch.originalContent);
      console.log(`   💾 Backup created: ${backupPath}`);
      
      // Apply changes
      await fs.writeFile(patch.filePath, patch.modifiedContent);
      console.log(`   ✅ Changes applied`);
    } else {
      console.log(`   📋 Would apply ${patch.changes} changes`);
    }
  }

  if (dryRun) {
    console.log(`\n💡 Run with --apply flag to actually apply changes`);
  }
}

/**
 * Main migration function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const generateReport = args.includes('--report');

  console.log('🔄 RPC Function Migration Tool\n');

  try {
    // Step 1: Find all relevant files
    console.log('🔍 Finding TypeScript files...');
    const files = await findRPCFiles();
    console.log(`   Found ${files.length} files to analyze\n`);

    // Step 2: Analyze each file
    console.log('📊 Analyzing RPC usage...');
    const analyses = [];
    
    for (const file of files) {
      const analysis = await analyzeFile(file);
      const suggestions = generateMigrationSuggestions(analysis);
      
      analyses.push({
        ...analysis,
        suggestions
      });
      
      if (analysis.rpcCalls.length > 0) {
        console.log(`   📄 ${file}: ${analysis.rpcCalls.length} RPC calls, ${suggestions.length} migratable`);
      }
    }

    // Step 3: Generate report
    const report = await createMigrationReport(analyses);
    
    console.log(`\n📈 Migration Analysis:`);
    console.log(`   Total Files: ${report.summary.totalFiles}`);
    console.log(`   Files with RPCs: ${report.summary.filesWithRPCs}`);
    console.log(`   Total RPC Calls: ${report.summary.totalRPCCalls}`);
    console.log(`   Migratable RPCs: ${report.summary.migratableRPCs}`);
    console.log(`   Migration Coverage: ${Math.round((report.summary.migratableRPCs / report.summary.totalRPCCalls) * 100)}%`);

    if (report.unmigratableFunctions.length > 0) {
      console.log(`\n⚠️  Unmigratable Functions:`);
      report.unmigratableFunctions.slice(0, 5).forEach(func => {
        console.log(`   - ${func.functionName} (${func.usageCount} uses)`);
      });
      if (report.unmigratableFunctions.length > 5) {
        console.log(`   ... and ${report.unmigratableFunctions.length - 5} more`);
      }
    }

    // Step 4: Save report if requested
    if (generateReport) {
      const reportPath = path.join(__dirname, '../docs/rpc-migration-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    }

    // Step 5: Generate and apply patches
    if (report.summary.migratableRPCs > 0) {
      console.log('\n🔧 Generating migration patches...');
      const patches = await generateMigrationPatches(analyses);
      await applyMigrationPatches(patches, dryRun);
      
      if (dryRun) {
        console.log(`\n💡 To apply changes, run: node ${__filename} --apply`);
        console.log(`💡 To generate detailed report, run: node ${__filename} --report`);
      }
    } else {
      console.log('\n✅ No migratable RPC calls found or all already migrated!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main();
}

module.exports = {
  findRPCFiles,
  analyzeFile,
  generateMigrationSuggestions,
  createMigrationReport,
  generateMigrationPatches,
  applyMigrationPatches
};