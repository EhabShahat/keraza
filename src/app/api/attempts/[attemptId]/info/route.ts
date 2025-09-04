import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const svc = supabaseServer();

    // Fetch basic attempt info with exam details (public data only)
    const { data, error } = await svc
      .from("exam_attempts")
      .select(`
        submitted_at,
        student_name,
        exams!inner(
          title,
          description,
          duration_minutes,
          start_time,
          end_time
        ),
        students(student_name)
      `)
      .eq("id", attemptId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const examData = (data as any).exams;

    return NextResponse.json({
      student_name: (data as any).students?.student_name || (data as any).student_name || null,
      exam_title: examData?.title,
      submitted_at: data.submitted_at,
      exam: {
        title: examData?.title,
        description: examData?.description,
        duration_minutes: examData?.duration_minutes,
        start_time: examData?.start_time,
        end_time: examData?.end_time,
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}