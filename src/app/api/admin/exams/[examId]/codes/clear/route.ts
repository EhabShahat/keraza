import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

// POST: Clear all students from an exam
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ examId: string }> }
) {
  const { examId } = await ctx.params;
  await requireAdmin(request);
  const token = await getBearerToken(request);
  const supabase = supabaseServer(token || undefined);

  // Verify the exam exists
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .single();

  if (examError || !exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  // Delete all per-exam tracking rows for this exam in student_exam_attempts
  const { error: clearError } = await supabase
    .from("student_exam_attempts")
    .delete()
    .eq("exam_id", examId);

  if (clearError) {
    console.error("Error clearing students from exam:", clearError);
    return NextResponse.json(
      { error: "Failed to clear students from exam" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}