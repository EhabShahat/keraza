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
<<<<<<< HEAD
        submitted_at,
        student_name,
        exams!inner(
=======
        exam_id,
        student_id,
        submitted_at,
        student_name,
        exams!inner(
          id,
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
          title,
          description,
          duration_minutes,
          start_time,
          end_time
        ),
<<<<<<< HEAD
        students(student_name)
=======
        students(code, student_name)
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
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
<<<<<<< HEAD
=======
      attempt_id: attemptId,
      exam_id: (data as any).exam_id || null,
      student_id: (data as any).student_id || null,
      student_code: (data as any).students?.code || null,
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
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