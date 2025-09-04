import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCodeFormatSettings, validateCodeFormat } from "@/lib/codeGenerator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim() || "";

    // Get code format settings and validate
    const codeSettings = await getCodeFormatSettings();
    if (!validateCodeFormat(code, codeSettings)) {
      return NextResponse.json({ valid: false, reason: "format", exams: [] }, { status: 400 });
    }

    const svc = supabaseServer();

    // 1) Find student by global code
    const { data: stuRows, error: stuErr } = await svc
      .from("students")
      .select("id, student_name")
      .eq("code", code)
      .limit(1);

    if (stuErr) {
      if (stuErr.code === "42P01" || stuErr.code === "42703") {
        // table/column missing (older schema) -> treat as invalid
        return NextResponse.json({ valid: false, exams: [] }, { status: 400 });
      }
      console.error("by-code students error:", stuErr);
      return NextResponse.json({ valid: false, exams: [] }, { status: 500 });
    }

    if (!stuRows || stuRows.length === 0) {
      return NextResponse.json({ valid: false, reason: "not_found", exams: [] }, { status: 404 });
    }

    const studentId = (stuRows[0] as { id: string; student_name?: string | null }).id;
    const studentName = (stuRows[0] as { id: string; student_name?: string | null }).student_name || null;

    // 2) Fetch all published code-based exams
    const { data: exams, error: exErr } = await svc
      .from("exams")
      .select("id, title, description, duration_minutes, start_time, end_time, status, access_type")
      .eq("status", "published")
      .eq("access_type", "code_based")
      .order("created_at", { ascending: false });

    if (exErr) {
      console.error("by-code exams error:", exErr);
      return NextResponse.json({ valid: false, exams: [] }, { status: 500 });
    }

    const examIds = (exams || []).map((e: any) => e.id);

    // Early return if no exams
    if (!examIds.length) {
      return NextResponse.json({ valid: true, student_id: studentId, student_name: studentName, exams: [] });
    }

    // 3) Fetch student's attempts per exam
    const { data: attempts, error: attErr } = await svc
      .from("student_exam_attempts")
      .select("exam_id, status, attempt_id")
      .eq("student_id", studentId)
      .in("exam_id", examIds);

    if (attErr) {
      console.error("by-code attempts error:", attErr);
      // Non-fatal - continue without attempt statuses
    }

    const attemptsMap = new Map<string, { status: string | null; attempt_id: string | null }>();
    for (const row of attempts || []) {
      attemptsMap.set((row as any).exam_id, {
        status: (row as any).status || null,
        attempt_id: (row as any).attempt_id || null,
      });
    }

    const now = new Date();
    const result = (exams || []).map((e: any) => {
      const start = e.start_time ? new Date(e.start_time) : null;
      const end = e.end_time ? new Date(e.end_time) : null;
      const not_started = !!(start && now < start);
      const ended = !!(end && now > end);
      const is_active = !not_started && !ended;
      const at = attemptsMap.get(e.id) || { status: null, attempt_id: null };
      const attempt_status = (at.status as "in_progress" | "completed" | null) || null;
      const already_attempted = attempt_status === "in_progress" || attempt_status === "completed";
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        duration_minutes: e.duration_minutes,
        start_time: e.start_time,
        end_time: e.end_time,
        status: e.status,
        access_type: e.access_type,
        is_active,
        not_started,
        ended,
        attempt_status,
        attempt_id: at.attempt_id,
        already_attempted,
      };
    });

    return NextResponse.json({ valid: true, student_id: studentId, student_name: studentName, exams: result });
  } catch (e) {
    console.error("Unexpected error in by-code:", e);
    return NextResponse.json({ valid: false, exams: [] }, { status: 500 });
  }
}
