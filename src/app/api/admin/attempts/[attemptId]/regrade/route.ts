import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { attemptId } = await ctx.params;
    if (!attemptId) return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });

    const svc = supabaseServer();
    const { data, error } = await svc.rpc("regrade_attempt", { p_attempt_id: attemptId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await auditLog(admin.user_id, "regrade_attempt", { attempt_id: attemptId });
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, result: row });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
