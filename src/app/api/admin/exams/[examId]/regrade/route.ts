import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { examId } = await ctx.params;
    if (!examId) return NextResponse.json({ error: "missing_exam_id" }, { status: 400 });

    const svc = supabaseServer();
    const { data, error } = await svc.rpc("regrade_exam", { p_exam_id: examId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await auditLog(admin.user_id, "regrade_exam", { exam_id: examId });
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, result: row });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
