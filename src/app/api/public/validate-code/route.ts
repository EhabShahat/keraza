import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")?.trim() || "";
    const examId = request.nextUrl.searchParams.get("examId")?.trim() || null;

    // Enforce 4-digit numeric format
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json({ valid: false, reason: "format" });
    }

    const svc = supabaseServer();

    // When examId is provided, validate the code within that exam scope and ensure it's unused
    if (examId) {
      // 1) Find student by global code
      const { data: stuRows, error: stuErr } = await svc
        .from("students")
        .select("id")
        .eq("code", code)
        .limit(1);

      if (stuErr) {
        if (stuErr.code === "42P01" || stuErr.code === "42703") {
          return NextResponse.json({ valid: false });
        }
        console.error("validate-code students error:", stuErr);
        return NextResponse.json({ valid: false }, { status: 500 });
      }

      if (!stuRows || stuRows.length === 0) {
        return NextResponse.json({ valid: false, reason: "not_found" });
      }

      const studentId = (stuRows[0] as { id: string }).id;

      // 2) Ensure no prior attempt for this student+exam via student_exam_attempts
      const { count: attCount, error: attErr } = await svc
        .from("student_exam_attempts")
        .select("id", { count: "exact", head: true })
        .eq("exam_id", examId)
        .eq("student_id", studentId);

      if (attErr) {
        if (attErr.code === "42P01" || attErr.code === "42703") {
          return NextResponse.json({ valid: false });
        }
        console.error("validate-code attempts error:", attErr);
        return NextResponse.json({ valid: false }, { status: 500 });
      }

      if ((attCount ?? 0) > 0) {
        return NextResponse.json({ valid: false, reason: "used" });
      }
      return NextResponse.json({ valid: true });
    }

    // Without examId: treat any existence of the code (used or unused) as valid
    const { error: existsErr, count: existsCount } = await svc
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("code", code);

    if (existsErr) {
      if (
        existsErr.code === "42P01" /* undefined_table */ ||
        existsErr.code === "42703" /* undefined_column */
      ) {
        return NextResponse.json({ valid: false });
      }
      console.error("validate-code exists-check error:", existsErr);
      return NextResponse.json({ valid: false }, { status: 500 });
    }

    return NextResponse.json({ valid: (existsCount ?? 0) > 0 });
  } catch (e) {
    console.error("Unexpected error in validate-code:", e);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

