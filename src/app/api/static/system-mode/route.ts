/**
 * Static Generation API Route for System Mode
 * Uses Incremental Static Regeneration (ISR) for optimal performance
 */

import { NextResponse } from "next/server";
import { 
  generateSystemModeData, 
  getContentRevalidateTime,
  getContentCacheTags 
} from "@/lib/static-generation/public-content";

export async function GET() {
  try {
    const data = await generateSystemModeData();
    
    const response = NextResponse.json(data);
    
    // Set cache headers for ISR
    const revalidateTime = getContentRevalidateTime('systemMode');
    const cacheTags = getContentCacheTags('systemMode');
    
    response.headers.set('Cache-Control', `s-maxage=${revalidateTime}, stale-while-revalidate`);
    response.headers.set('Cache-Tag', cacheTags.join(','));
    response.headers.set('X-Static-Generation', 'true');
    
    return response;
  } catch (error) {
    console.error("Static system mode generation error:", error);
    
    // Return fallback data
    return NextResponse.json({
      mode: "exam",
      message: null,
      error: "Static generation failed"
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
export const revalidate = getContentRevalidateTime('systemMode');
export const dynamic = 'force-static';
export const tags = getContentCacheTags('systemMode');