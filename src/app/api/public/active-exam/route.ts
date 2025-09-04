import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const svc = supabaseServer();
    
<<<<<<< HEAD
    // Look for the single active (published) exam
=======
    // Fetch all published exams (multiple published exams are allowed)
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
    const { data, error } = await svc
      .from("exams")
      .select("id, title, status, start_time, end_time, access_type, created_at")
      .eq("status", "published")
<<<<<<< HEAD
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
=======
      .order("start_time", { ascending: true, nullsFirst: true });

    if (error) {
      return NextResponse.json({ 
        error: {
          message: error.message,
          code: (error as any).code,
          details: (error as any).details
        }
      }, { status: 400 });
    }

    const now = new Date();
    const list = (data || []).map((e) => {
      const start = e.start_time ? new Date(e.start_time as any) : null;
      const end = e.end_time ? new Date(e.end_time as any) : null;
      const notStarted = !!(start && now < start);
      const ended = !!(end && now > end);
      const isActive = !notStarted && !ended;
      return {
        ...e,
        is_active: isActive,
        not_started: notStarted,
        ended,
      };
    });

    // Backward compatibility: keep a single activeExam field (first active or first item)
    const firstActive = list.find((e) => e.is_active) || list[0] || null;
    const activeExam = firstActive
      ? {
          id: firstActive.id,
          title: firstActive.title,
          status: firstActive.status,
          start_time: firstActive.start_time,
          end_time: firstActive.end_time,
          access_type: firstActive.access_type,
          created_at: (firstActive as any).created_at,
        }
      : null;

    const startTime = (firstActive?.start_time ? new Date(firstActive.start_time as any) : null) as Date | null;
    const endTime = (firstActive?.end_time ? new Date(firstActive.end_time as any) : null) as Date | null;
    const isNotStarted = !!(startTime && now < startTime);
    const isEnded = !!(endTime && now > endTime);
    const isActive = !!firstActive && !isNotStarted && !isEnded;

    return NextResponse.json({
      activeExam,
      activeExams: list,
      isActive,
      timeCheck: activeExam
        ? {
            now: now.toISOString(),
            startTime: startTime ? startTime.toISOString() : null,
            endTime: endTime ? endTime.toISOString() : null,
            isNotStarted,
            isEnded,
          }
        : null,
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}