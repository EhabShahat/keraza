#!/usr/bin/env node

/**
 * Build Script for Static Content Generation
 * Runs during the build process to pre-generate static content
 */

const { writeFile, mkdir } = require('fs/promises');
const { join } = require('path');

/**
 * Simple static content generation without TypeScript dependencies
 */
async function generateStaticContent() {
  try {
    console.log("🚀 Starting static content generation...");
    
    // Create static directory if it doesn't exist
    const staticDir = join(process.cwd(), ".next", "static-content");
    await mkdir(staticDir, { recursive: true });
    
    // Generate basic static content
    const defaultContent = {
      systemMode: { 
        mode: 'exam', 
        message: null,
        enabled: true 
      },
      appSettings: { 
        brand_name: 'Advanced Exam System',
        default_language: 'en',
        enable_name_search: true,
        enable_code_search: true
      },
      codeSettings: { 
        code_length: 4,
        code_format: 'numeric',
        code_pattern: null
      },
      activeExams: {
        exams: []
      }
    };
    
    // Write static files
    await Promise.all([
      writeFile(
        join(staticDir, "system-mode.json"),
        JSON.stringify(defaultContent.systemMode, null, 2)
      ),
      writeFile(
        join(staticDir, "app-settings.json"),
        JSON.stringify(defaultContent.appSettings, null, 2)
      ),
      writeFile(
        join(staticDir, "code-settings.json"),
        JSON.stringify(defaultContent.codeSettings, null, 2)
      ),
      writeFile(
        join(staticDir, "active-exams.json"),
        JSON.stringify(defaultContent.activeExams, null, 2)
      )
    ]);
    
    console.log("✅ Static content generation completed");
    
    // Generate manifest
    const manifest = {
      generated_at: new Date().toISOString(),
      build_id: `build-${Date.now()}`,
      content_types: Object.keys(defaultContent),
      files: [
        "system-mode.json",
        "app-settings.json", 
        "code-settings.json",
        "active-exams.json"
      ]
    };
    
    await writeFile(
      join(staticDir, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );
    
    console.log("📋 Static content manifest created");
    
  } catch (error) {
    console.error("❌ Static content generation failed:", error);
    // Don't throw - allow build to continue
  }
}

/**
 * Generate critical CSS
 */
async function generateCriticalCSS() {
  try {
    const criticalCSS = `
      /* Critical CSS for above-the-fold content */
      body {
        font-family: 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #ffffff;
        color: #1f2937;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
      }
      
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-weight: 500;
        text-decoration: none;
        transition: all 0.2s;
        cursor: pointer;
        border: 1px solid transparent;
      }
      
      .btn-primary {
        background-color: #3b82f6;
        color: white;
      }
      
      .btn-primary:hover {
        background-color: #2563eb;
      }
      
      .card {
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        padding: 1.5rem;
      }
      
      .input {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 1rem;
      }
      
      .input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      /* RTL Support */
      [dir="rtl"] {
        text-align: right;
      }
      
      [dir="rtl"] .btn {
        flex-direction: row-reverse;
      }
      
      /* Loading states */
      .loading {
        opacity: 0.6;
        pointer-events: none;
      }
      
      .spinner {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border: 2px solid #f3f4f6;
        border-top: 2px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `.trim();
    
    const criticalDir = join(process.cwd(), ".next", "critical");
    await mkdir(criticalDir, { recursive: true });
    
    await writeFile(
      join(criticalDir, "critical.css"),
      criticalCSS
    );
    
    console.log("🎨 Critical CSS generated");
    
  } catch (error) {
    console.error("❌ Critical CSS generation failed:", error);
  }
}

async function main() {
  console.log('🚀 Starting static content build process...');
  
  try {
    // Set environment for build
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    
    // Run build optimizations
    await Promise.all([
      generateStaticContent(),
      generateCriticalCSS()
    ]);
    
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