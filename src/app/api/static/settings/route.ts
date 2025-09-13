/**
 * Static Generation API Route for App Settings
 * Uses Incremental Static Regeneration (ISR) for optimal performance
 */

import { NextResponse } from "next/server";
import { 
  generateAppSettingsData, 
  getContentRevalidateTime,
  getContentCacheTags 
} from "@/lib/static-generation/public-content";

export async function GET() {
  try {
    const data = await generateAppSettingsData();
    
    const response = NextResponse.json(data);
    
    // Set cache headers for ISR
    const revalidateTime = getContentRevalidateTime('appSettings');
    const cacheTags = getContentCacheTags('appSettings');
    
    response.headers.set('Cache-Control', `s-maxage=${revalidateTime}, stale-while-revalidate`);
    response.headers.set('Cache-Tag', cacheTags.join(','));
    response.headers.set('X-Static-Generation', 'true');
    
    return response;
  } catch (error) {
    console.error("Static app settings generation error:", error);
    
    // Return fallback data
    return NextResponse.json({}, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Static-Generation': 'error'
      }
    });
  }
}

// Enable ISR
export const revalidate = 1800; // 30 minutes
export const dynamic = 'force-static';