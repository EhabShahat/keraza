import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    // Preferred: use RPC if available (define in DB):
    // create or replace function admin_list_attempts(p_exam_id uuid) returns setof ...
    const rpc = await svc.rpc("admin_list_attempts", { p_exam_id: examId });
    if (!rpc.error && Array.isArray(rpc.data)) {
      return NextResponse.json({ items: rpc.data });
    }
    // Log RPC failure for observability
    if (rpc.error) {
      // eslint-disable-next-line no-console
      console.warn("admin_list_attempts RPC failed, using fallback query:", rpc.error.message || rpc.error);
    }

    // Fallback: join exam_attempts with students via student_id
    const fb = await svc
      .from("exam_attempts")
      .select("id, exam_id, ip_address, started_at, submitted_at, completion_status, students(student_name, code), exam_results(score_percentage)")
      .eq("exam_id", examId)
      .order("started_at", { ascending: false, nullsFirst: true });
    if (!fb.error) {
      const items = (fb.data ?? []).map((a: any) => ({
        id: a.id,
        exam_id: a.exam_id,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        completion_status: a.completion_status,
        ip_address: a.ip_address,
        student_name: a?.students?.student_name ?? a?.student_name ?? null,
        score_percentage: a?.exam_results?.score_percentage ?? null,
      }));
      return NextResponse.json({ items });
    }

    // If neither RPC nor table exists, surface a clear signal to configure backend
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
