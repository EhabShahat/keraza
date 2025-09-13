import { NextRequest, NextResponse } from "next/server";
import { RealtimeAttemptManager } from "@/lib/api/realtime-attempt";

export const dynamic = "force-dynamic";

// Global instance for real-time management
const realtimeManager = new RealtimeAttemptManager();

/**
 * Server-Sent Events endpoint for real-time attempt monitoring
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await ctx.params;
    if (!attemptId) {
      return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const lastEventId = url.searchParams.get("lastEventId");
    const connectionId = url.searchParams.get("connectionId") || `conn_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Initialize real-time monitoring for this attempt
    await realtimeManager.initializeRealtimeMonitoring(attemptId, connectionId);

    // Create Server-Sent Events stream
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        const initialEvent = {
          type: 'connection',
          attemptId,
          data: { connected: true, connectionId },
          timestamp: new Date().toISOString()
        };
        
        controller.enqueue(`data: ${JSON.stringify(initialEvent)}\n\n`);

        // Send any pending events
        const pendingEvents = realtimeManager.getPendingEvents(attemptId, lastEventId || undefined);
        for (const event of pendingEvents) {
          controller.enqueue(`id: ${event.timestamp}\n`);
          controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
        }

        // Set up periodic heartbeat and event checking
        const heartbeatInterval = setInterval(() => {
          try {
            // Send heartbeat
            const heartbeat = {
              type: 'heartbeat',
              attemptId,
              data: { timestamp: new Date().toISOString() },
              timestamp: new Date().toISOString()
            };
            controller.enqueue(`data: ${JSON.stringify(heartbeat)}\n\n`);

            // Check for new events
            const newEvents = realtimeManager.getPendingEvents(attemptId);
            for (const event of newEvents) {
              controller.enqueue(`id: ${event.timestamp}\n`);
              controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
            }
          } catch (error) {
            console.error('SSE heartbeat error:', error);
            clearInterval(heartbeatInterval);
            controller.close();
          }
        }, 5000); // 5 second heartbeat

        // Clean up on close
        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          realtimeManager.cleanupRealtimeMonitoring(attemptId, connectionId);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error: any) {
    console.error('SSE endpoint error:', error);
    return NextResponse.json(
      { error: error.message || "unexpected_error" },
      { status: 500 }
    );
  }
}

/**
 * Handle real-time event posting (for testing and manual events)
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await ctx.params;
    if (!attemptId) {
      return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { type, data } = body;

    if (!type) {
      return NextResponse.json({ error: "missing_event_type" }, { status: 400 });
    }

    // Create and broadcast custom event
    const event = {
      type,
      attemptId,
      data: data || {},
      timestamp: new Date().toISOString()
    };

    // This would normally be handled by the RealtimeAttemptManager
    // For now, we'll just acknowledge the event
    return NextResponse.json({ 
      success: true, 
      event,
      message: "Event queued for broadcast" 
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "unexpected_error" },
      { status: 500 }
    );
  }
}