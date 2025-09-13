#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function scanAPIDirectory(dirPath = 'src/app/api', basePath = 'src/app/api') {
  const functions = [];
  
  async function scanDirectory(currentPath, relativePath = '') {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const newRelativePath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, newRelativePath);
        } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const stats = await fs.stat(fullPath);
            
            const apiPath = relativePath.replace(/\\/g, '/');
            const category = categorizeFunction(apiPath);
            
            const func = {
              name: apiPath.replace(/\//g, '_') || 'root',
              path: '/api/' + apiPath,
              fullPath: newRelativePath,
              methods: extractHTTPMethods(content),
              category,
              fileSize: stats.size,
              dependencies: extractDependencies(content),
              complexity: assessComplexity(content, stats.size),
              consolidationCandidate: isConsolidationCandidate(apiPath, content, category)
            };
            
            functions.push(func);
          } catch (error) {
            console.warn(`⚠️  Could not analyze ${fullPath}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not scan directory ${currentPath}:`, error.message);
    }
  }
  
  await scanDirectory(dirPath);
  return functions;
}

function extractHTTPMethods(content) {
  const methods = [];
  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  
  for (const method of httpMethods) {
    if (content.includes(`export async function ${method}`) || 
        content.includes(`export function ${method}`)) {
      methods.push(method);
    }
  }
  
  return methods.length > 0 ? methods : ['GET'];
}

function categorizeFunction(apiPath) {
  if (apiPath.startsWith('admin/')) return 'admin';
  if (apiPath.startsWith('public/')) return 'public';
  if (apiPath.startsWith('attempts/')) return 'attempts';
  if (apiPath.startsWith('auth/')) return 'auth';
  return 'utility';
}

function extractDependencies(content) {
  const dependencies = [];
  
  if (content.includes('supabase')) dependencies.push('supabase');
  if (content.includes('NextRequest')) dependencies.push('next');
  if (content.includes('jwt') || content.includes('jose')) dependencies.push('jwt');
  if (content.includes('requireAdmin')) dependencies.push('admin-auth');
  if (content.includes('zod')) dependencies.push('validation');
  
  return dependencies;
}

function assessComplexity(content, fileSize) {
  let complexityScore = 0;
  
  // File size factor
  if (fileSize > 5000) complexityScore += 2;
  else if (fileSize > 2000) complexityScore += 1;
  
  // Content complexity factors
  if (content.includes('try') && content.includes('catch')) complexityScore += 1;
  if (content.includes('Promise.all')) complexityScore += 1;
  if (content.includes('transaction')) complexityScore += 2;
  if (content.includes('rpc(')) complexityScore += 1;
  if ((content.match(/await/g) || []).length > 5) complexityScore += 1;
  if ((content.match(/if\s*\(/g) || []).length > 3) complexityScore += 1;
  
  if (complexityScore >= 4) return 'high';
  if (complexityScore >= 2) return 'medium';
  return 'low';
}

function isConsolidationCandidate(apiPath, content, category) {
  // Admin and public functions are good candidates
  if (category === 'admin' || category === 'public') return true;
  
  // Simple CRUD operations
  if (content.includes('SELECT') || content.includes('INSERT') || 
      content.includes('UPDATE') || content.includes('DELETE')) return true;
  
  // Small utility functions
  if (content.length < 1000) return true;
  
  return false;
}

function generateRecommendations(functions) {
  const recommendations = [];
  
  if (functions.length > 50) {
    recommendations.push(`High function count (${functions.length}). Immediate consolidation recommended.`);
  }
  
  const adminFunctions = functions.filter(f => f.category === 'admin');
  if (adminFunctions.length > 10) {
    recommendations.push(`${adminFunctions.length} admin functions can be consolidated into 1-2 handlers.`);
  }
  
  const publicFunctions = functions.filter(f => f.category === 'public');
  if (publicFunctions.length > 5) {
    recommendations.push(`${publicFunctions.length} public functions can be consolidated with caching.`);
  }
  
  const attemptFunctions = functions.filter(f => f.category === 'attempts');
  if (attemptFunctions.length > 3) {
    recommendations.push(`${attemptFunctions.length} attempt functions can be unified into single handler.`);
  }
  
  const candidates = functions.filter(f => f.consolidationCandidate);
  if (candidates.length > functions.length * 0.7) {
    recommendations.push(`${candidates.length} functions are consolidation candidates (${Math.round(candidates.length / functions.length * 100)}%).`);
  }
  
  return recommendations;
}

async function main() {
  console.log('🚀 Starting Simple Function Audit...\n');
  
  try {
    // Scan all API functions
    const functions = await scanAPIDirectory();
    
    // Generate metrics
    const functionsByCategory = {};
    const functionsByComplexity = {};
    let totalFileSize = 0;
    
    functions.forEach(func => {
      functionsByCategory[func.category] = (functionsByCategory[func.category] || 0) + 1;
      functionsByComplexity[func.complexity] = (functionsByComplexity[func.complexity] || 0) + 1;
      totalFileSize += func.fileSize;
    });
    
    const consolidationCandidates = functions.filter(f => f.consolidationCandidate);
    const recommendations = generateRecommendations(functions);
    
    // Calculate potential savings
    const adminSavings = Math.floor((functionsByCategory.admin || 0) * 0.8);
    const publicSavings = Math.floor((functionsByCategory.public || 0) * 0.7);
    const attemptSavings = Math.floor((functionsByCategory.attempts || 0) * 0.8);
    const utilitySavings = Math.floor((functionsByCategory.utility || 0) * 0.5);
    const potentialSavings = adminSavings + publicSavings + attemptSavings + utilitySavings;
    
    // Print results
    console.log('='.repeat(60));
    console.log('📊 FUNCTION AUDIT REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n📈 Overview:`);
    console.log(`   Total Functions: ${functions.length}`);
    console.log(`   Consolidation Candidates: ${consolidationCandidates.length}`);
    console.log(`   Potential Savings: ${potentialSavings} functions`);
    console.log(`   Optimization Potential: ${Math.round((potentialSavings / functions.length) * 100)}%`);
    
    console.log(`\n📂 Functions by Category:`);
    Object.entries(functionsByCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
    
    console.log(`\n🔧 Functions by Complexity:`);
    Object.entries(functionsByComplexity).forEach(([complexity, count]) => {
      console.log(`   ${complexity}: ${count}`);
    });
    
    console.log(`\n💡 Recommendations:`);
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    
    console.log(`\n🎯 Top Consolidation Candidates:`);
    consolidationCandidates
      .sort((a, b) => b.fileSize - a.fileSize)
      .slice(0, 10)
      .forEach((func, index) => {
        console.log(`   ${index + 1}. ${func.path} (${func.category}, ${func.complexity} complexity)`);
      });
    
    // Export results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = `function-audit-${timestamp}.json`;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFunctions: functions.length,
        consolidationCandidates: consolidationCandidates.length,
        potentialSavings,
        optimizationPotential: Math.round((potentialSavings / functions.length) * 100)
      },
      functions,
      metrics: {
        functionsByCategory,
        functionsByComplexity,
        totalFileSize,
        averageFileSize: totalFileSize / functions.length
      },
      recommendations
    };
    
    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Audit completed successfully!');
    console.log(`📄 Detailed report saved to: ${outputPath}`);
    
    if (functions.length > 50) {
      console.log(`\n⚠️  WARNING: ${functions.length} functions detected!`);
      console.log(`   This exceeds typical Netlify limits and requires immediate optimization.`);
    }
    
    console.log(`\n📋 Next Steps:`);
    console.log(`   1. Review the detailed report: ${outputPath}`);
    console.log(`   2. Set up the function registry database`);
    console.log(`   3. Visit the optimization dashboard: /admin/optimization`);
    console.log(`   4. Start with highest-impact consolidations first`);
    
  } catch (error) {
    console.error('❌ Error during audit:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };