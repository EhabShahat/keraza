import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

// GET: Retrieve all students for a specific exam
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
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

  // Get all students who have an attempt record for this exam with their status
  const { data: rows, error } = await supabase
    .from("student_exam_attempts")
    .select(`
      exam_id,
      student_id,
      status,
      attempt_id,
      started_at,
      completed_at,
      students ( id, code, student_name, mobile_number, created_at )
    `)
    .eq("exam_id", examId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error fetching students for exam:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }

  const students = (rows || []).map((r: any) => ({
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
  }));

  return NextResponse.json({ students });
}

// POST: Add students to an exam
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
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
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid request format. Expected 'items' array." },
        { status: 400 }
      );
    }

    // First, ensure all students exist in the global students table
    // We'll use the bulk API for this
    const studentsRes = await fetch(new URL("/api/admin/students/bulk", request.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward authorization headers
        ...Object.fromEntries(
          [...request.headers.entries()].filter(([key]) => 
            key.toLowerCase() === "authorization" || key.toLowerCase() === "cookie"
          )
        )
      },
      body: JSON.stringify({ students: items })
    });

    if (!studentsRes.ok) {
      const errorData = await studentsRes.json();
      return NextResponse.json(
        { error: errorData.error || "Failed to add students" },
        { status: studentsRes.status }
      );
    }

    const studentsResult = await studentsRes.json();

    // New behavior: only ensure students exist in global table.
    // No linking table and no exam_codes upsert.
    return NextResponse.json({
      success: studentsResult.success,
      errors: studentsResult.errors,
      message: `Successfully ensured ${Array.isArray(items) ? items.length : 0} students exist in public.students`
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}