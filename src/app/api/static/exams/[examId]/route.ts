/**
 * Static Generation API Route for Exam Information
 * Uses Incremental Static Regeneration (ISR) for optimal performance
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  generateExamInfoData, 
  getContentRevalidateTime,
  getContentCacheTags 
} from "@/lib/static-generation/public-content";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;
    
    if (!examId) {
      return NextResponse.json({
        error: "Exam ID is required"
      }, { status: 400 });
    }
    
    const data = await generateExamInfoData(examId);
    
    const response = NextResponse.json(data);
    
    // Set cache headers for ISR
    const revalidateTime = getContentRevalidateTime('examInfo');
    const cacheTags = getContentCacheTags('examInfo');
    
    response.headers.set('Cache-Control', `s-maxage=${revalidateTime}, stale-while-revalidate`);
    response.headers.set('Cache-Tag', [...cacheTags, `exam-${examId}`].join(','));
    response.headers.set('X-Static-Generation', 'true');
    
    return response;
  } catch (error) {
    console.error("Static exam info generation error:", error);
    
    // Return fallback data
    return NextResponse.json({
      error: "Static generation failed"
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Static-Generation': 'error'
      }
    });
  }
}

// Enable ISR
export const revalidate = 900; // 15 minutes
export const dynamic = 'force-static';