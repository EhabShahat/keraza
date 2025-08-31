import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

// GET: Retrieve a specific student for an exam
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ examId: string; codeId: string }> }
) {
  const { examId, codeId } = await ctx.params;
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

  // Fetch student's per-exam status via student_exam_attempts joined with students
  const { data: rows, error } = await supabase
    .from("student_exam_attempts")
    .select(`
      exam_id,
      student_id,
      status,
      attempt_id,
      started_at,
      completed_at,
      students!inner(id, code, student_name, mobile_number, created_at)
    `)
    .eq("exam_id", examId)
    .eq("students.code", codeId)
    .limit(1);

  if (error) {
    console.error("Error fetching student for exam:", error);
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  let student;
  if (rows && rows.length > 0) {
    const r: any = rows[0];
    student = {
      exam_id: r.exam_id,
      student_id: r.student_id,
      code: r.students?.code || null,
      student_name: r.students?.student_name || null,
      mobile_number: r.students?.mobile_number || null,
      student_created_at: r.students?.created_at || null,
      status: r.status,
      attempt_id: r.attempt_id,
      started_at: r.started_at,
      completed_at: r.completed_at,
    };
  } else {
    // Fallback: return basic student info if they exist globally even if no attempt for this exam
    const { data: s, error: sErr } = await supabase
      .from("students")
      .select("id, code, student_name, mobile_number, created_at")
      .eq("code", codeId)
      .single();
    if (sErr || !s) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    student = {
      exam_id: examId,
      student_id: s.id,
      code: s.code,
      student_name: s.student_name,
      mobile_number: s.mobile_number,
      student_created_at: s.created_at,
      status: null,
      attempt_id: null,
      started_at: null,
      completed_at: null,
    };
  }

  return NextResponse.json({ student });
}

// DELETE: Remove a student from an exam
export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ examId: string; codeId: string }> }
) {
  const { examId, codeId } = await ctx.params;
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

  // First, get the student ID from the code
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("code", codeId)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Remove any per-exam linkage/attempt tracking for this student
  const { error: unlinkError } = await supabase
    .from("student_exam_attempts")
    .delete()
    .eq("exam_id", examId)
    .eq("student_id", student.id);

  if (unlinkError) {
    console.error("Error removing student from exam:", unlinkError);
    return NextResponse.json(
      { error: "Failed to remove student from exam" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

// PATCH: Update a student's details for an exam
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ examId: string; codeId: string }> }
) {
  const { examId, codeId } = await ctx.params;
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

  try {
    const body = await request.json();
    const { student_name, mobile_number, code } = body;

    // First, update the student in the global students table
    // We'll use the global student API for this
    const studentUpdateRes = await fetch(
      new URL(`/api/admin/students/${codeId}`, request.url).toString(),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          // Forward authorization headers
          ...Object.fromEntries(
            [...request.headers.entries()].filter(
              ([key]) =>
                key.toLowerCase() === "authorization" ||
                key.toLowerCase() === "cookie"
            )
          ),
        },
        body: JSON.stringify({ student_name, mobile_number, code }),
      }
    );

    if (!studentUpdateRes.ok) {
      const errorData = await studentUpdateRes.json();
      return NextResponse.json(
        { error: errorData.error || "Failed to update student" },
        { status: studentUpdateRes.status }
      );
    }

    const result = await studentUpdateRes.json();
    return NextResponse.json({ student: result.student });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}