/**
 * Static Generation API Route for Active Exams
 * Uses Incremental Static Regeneration (ISR) for optimal performance
 */

import { NextResponse } from "next/server";
import { 
  generateActiveExamsData, 
  getContentRevalidateTime,
  getContentCacheTags 
} from "@/lib/static-generation/public-content";

export async function GET() {
  try {
    const data = await generateActiveExamsData();
    
    const response = NextResponse.json(data);
    
    // Set cache headers for ISR
    const revalidateTime = getContentRevalidateTime('activeExams');
    const cacheTags = getContentCacheTags('activeExams');
    
    response.headers.set('Cache-Control', `s-maxage=${revalidateTime}, stale-while-revalidate`);
    response.headers.set('Cache-Tag', cacheTags.join(','));
    response.headers.set('X-Static-Generation', 'true');
    
    return response;
  } catch (error) {
    console.error("Static active exams generation error:", error);
    
    // Return fallback data
    return NextResponse.json({
      error: "Static generation failed",
      code: "generation_error",
      details: "Unable to generate static content"
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
export const revalidate = getContentRevalidateTime('activeExams');
export const dynamic = 'force-static';
export const tags = getContentCacheTags('activeExams');