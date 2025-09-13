import { NextRequest, NextResponse } from "next/server";
import { RealtimeAttemptManager } from "@/lib/api/realtime-attempt";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events endpoint for real-time attempt monitoring
 * Usage: GET /api/attempts/[attemptId]/sse?connectionId=xxx
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await ctx.params;
    const url = new URL(req.url);
    const connectionId = url.searchParams.get("connectionId") || 
      `conn_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    if (!attemptId) {
      return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });
    }

    // Create real-time manager instance
    const realtimeManager = new RealtimeAttemptManager();

    // Create SSE stream
    const stream = await realtimeManager.createSSEStream(attemptId, connectionId);

    // Return SSE response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Cache-Control"
      }
    });

  } catch (error: any) {
    console.error("SSE endpoint error:", error);
    return NextResponse.json(
      { error: error.message || "sse_error" },
      { status: 500 }
    );
  }
}

/**
 * Handle preflight requests for CORS
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Cache-Control"
    }
  });
}