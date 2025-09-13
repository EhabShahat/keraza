/**
 * Build-time Optimization Utilities
 * Handles static asset optimization and pre-generation during build
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { generateAllPublicContent } from "./public-content";

/**
 * Build-time static content generation
 */
export async function generateStaticContent(): Promise<void> {
  try {
    console.log("🚀 Starting static content generation...");
    
    // Create static directory if it doesn't exist
    const staticDir = join(process.cwd(), ".next", "static-content");
    await mkdir(staticDir, { recursive: true });
    
    // Generate all public content
    const content = await generateAllPublicContent();
    
    // Write static files
    await Promise.all([
      writeFile(
        join(staticDir, "system-mode.json"),
        JSON.stringify(content.systemMode, null, 2)
      ),
      writeFile(
        join(staticDir, "app-settings.json"),
        JSON.stringify(content.appSettings, null, 2)
      ),
      writeFile(
        join(staticDir, "code-settings.json"),
        JSON.stringify(content.codeSettings, null, 2)
      ),
      writeFile(
        join(staticDir, "active-exams.json"),
        JSON.stringify(content.activeExams, null, 2)
      )
    ]);
    
    console.log("✅ Static content generation completed");
    
    // Generate manifest
    const manifest = {
      generated_at: new Date().toISOString(),
      content_types: Object.keys(content),
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
 * Asset optimization configuration
 */
export const ASSET_OPTIMIZATION_CONFIG = {
  images: {
    formats: ['webp', 'avif'],
    quality: 85,
    sizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },
  fonts: {
    preload: ['Tajawal-Regular.woff2', 'Tajawal-Bold.woff2'],
    display: 'swap'
  },
  css: {
    purge: true,
    minify: true,
    critical: true
  },
  js: {
    minify: true,
    treeshake: true,
    splitChunks: true
  }
} as const;

/**
 * Generate critical CSS for above-the-fold content
 */
export function generateCriticalCSS(): string {
  return `
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
}

/**
 * Generate preload links for critical resources
 */
export function generatePreloadLinks(): string[] {
  const preloads = [
    '<link rel="preload" href="/fonts/Tajawal-Regular.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preload" href="/fonts/Tajawal-Bold.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  ];
  
  return preloads;
}

/**
 * Generate resource hints for performance
 */
export function generateResourceHints(): string[] {
  const hints = [
    '<link rel="dns-prefetch" href="//fonts.googleapis.com">',
    '<link rel="dns-prefetch" href="//fonts.gstatic.com">',
    '<link rel="prefetch" href="/api/static/system-mode">',
    '<link rel="prefetch" href="/api/static/settings">'
  ];
  
  return hints;
}

/**
 * Build-time asset optimization
 */
export async function optimizeAssets(): Promise<void> {
  try {
    console.log("🎨 Starting asset optimization...");
    
    // Generate critical CSS
    const criticalCSS = generateCriticalCSS();
    const criticalDir = join(process.cwd(), ".next", "critical");
    await mkdir(criticalDir, { recursive: true });
    
    await writeFile(
      join(criticalDir, "critical.css"),
      criticalCSS
    );
    
    // Generate preload and resource hints
    const preloads = generatePreloadLinks();
    const hints = generateResourceHints();
    
    const htmlOptimizations = {
      preloads,
      hints,
      criticalCSS
    };
    
    await writeFile(
      join(criticalDir, "optimizations.json"),
      JSON.stringify(htmlOptimizations, null, 2)
    );
    
    console.log("✅ Asset optimization completed");
    
  } catch (error) {
    console.error("❌ Asset optimization failed:", error);
    // Don't throw - allow build to continue
  }
}

/**
 * Main build optimization function
 */
export async function runBuildOptimizations(): Promise<void> {
  console.log("🔧 Running build-time optimizations...");
  
  await Promise.all([
    generateStaticContent(),
    optimizeAssets()
  ]);
  
  console.log("🎉 Build optimizations completed!");
}

// Export for use in build scripts
if (require.main === module) {
  runBuildOptimizations().catch(console.error);
}