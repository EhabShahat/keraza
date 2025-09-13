/**
 * Static Generation API Route for Code Settings
 * Uses Incremental Static Regeneration (ISR) for optimal performance
 */

import { NextResponse } from "next/server";
import { 
  generateCodeSettingsData, 
  getContentRevalidateTime,
  getContentCacheTags 
} from "@/lib/static-generation/public-content";

export async function GET() {
  try {
    const data = await generateCodeSettingsData();
    
    const response = NextResponse.json(data);
    
    // Set cache headers for ISR
    const revalidateTime = getContentRevalidateTime('codeSettings');
    const cacheTags = getContentCacheTags('codeSettings');
    
    response.headers.set('Cache-Control', `s-maxage=${revalidateTime}, stale-while-revalidate`);
    response.headers.set('Cache-Tag', cacheTags.join(','));
    response.headers.set('X-Static-Generation', 'true');
    
    return response;
  } catch (error) {
    console.error("Static code settings generation error:", error);
    
    // Return fallback data
    return NextResponse.json({
      code_length: 4,
      code_format: "numeric",
      code_pattern: null
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Static-Generation': 'error'
      }
    });
  }
}

// Enable ISR
export const revalidate = getContentRevalidateTime('codeSettings');
export const dynamic = 'force-static';
export const tags = getContentCacheTags('codeSettings');