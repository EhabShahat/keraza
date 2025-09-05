import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { attemptId } = await ctx.params;
    if (!attemptId) return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const grades = Array.isArray(body?.grades) ? body.grades : [];
    if (!Array.isArray(grades) || grades.length === 0) {
      return NextResponse.json({ error: "grades_required" }, { status: 400 });
    }

    const rows = grades
      .map((g: any) => ({
        attempt_id: attemptId,
        question_id: g?.question_id,
        awarded_points: Number.isFinite(Number(g?.awarded_points)) ? Number(g.awarded_points) : 0,
        notes: typeof g?.notes === "string" ? g.notes : null,
      }))
      .filter((r: any) => typeof r.question_id === "string" && r.question_id.length > 0);

    if (rows.length === 0) {
      return NextResponse.json({ error: "invalid_rows" }, { status: 400 });
    }

    const svc = supabaseServer();
    const { error } = await svc.from("manual_grades").upsert(rows, { onConflict: "attempt_id,question_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Recalculate results immediately
    const { data: calc, error: calcErr } = await svc.rpc("regrade_attempt", { p_attempt_id: attemptId });
    if (calcErr) return NextResponse.json({ error: calcErr.message }, { status: 400 });

    await auditLog(admin.user_id, "save_manual_grades", { attempt_id: attemptId, count: rows.length });
    const resultRow = Array.isArray(calc) ? calc[0] : calc;
    return NextResponse.json({ ok: true, result: resultRow });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
