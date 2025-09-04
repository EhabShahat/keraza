import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const items: { id: string; order_index: number }[] = body?.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "no_items" }, { status: 400 });
    }
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const upserts = items.map((i) => ({ id: i.id, exam_id: examId, order_index: i.order_index }));
    const { error } = await svc.from("questions").upsert(upserts, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
