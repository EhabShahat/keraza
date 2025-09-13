#!/usr/bin/env node

/**
 * Build Script for Static Content Generation
 * Runs during the build process to pre-generate static content
 */

const { runBuildOptimizations } = require('../src/lib/static-generation/build-optimization.ts');

async function main() {
  console.log('🚀 Starting static content build process...');
  
  try {
    // Set environment for build
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    
    // Run build optimizations
    await runBuildOptimizations();
    
    console.log('✅ Static content build completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Static content build failed:', error);
    
    // Don't fail the build - just warn
    console.warn('⚠️  Continuing build without static content optimizations');
    process.exit(0);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in static content build:', error);
  process.exit(0); // Don't fail the build
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in static content build:', error);
  process.exit(0); // Don't fail the build
});

// Run the build
main();