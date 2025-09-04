import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const svc = supabaseServer();
    
    // Look for the single active (published) exam
    const { data, error } = await svc
      .from("exams")
      .select("id, title, status, start_time, end_time, access_type, created_at")
      .eq("status", "published")
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - no active exam
        return NextResponse.json({ 
          activeExam: null, 
          message: "No published exam found",
          error: { code: error.code }
        });
      } else {
        // Database error
        return NextResponse.json({ 
          error: {
            message: error.message,
            code: error.code,
            details: error.details
          }
        }, { status: 400 });
      }
    }

    // Check if exam is within time bounds
    const now = new Date();
    const startTime = data.start_time ? new Date(data.start_time) : null;
    const endTime = data.end_time ? new Date(data.end_time) : null;
    
    const isNotStarted = startTime && now < startTime;
    const isEnded = endTime && now > endTime;
    const isActive = !isNotStarted && !isEnded;

    return NextResponse.json({
      activeExam: data,
      isActive,
      timeCheck: {
        now: now.toISOString(),
        startTime: startTime?.toISOString() || null,
        endTime: endTime?.toISOString() || null,
        isNotStarted,
        isEnded
      }
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}