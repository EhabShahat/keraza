import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Ensure exam exists
    const ex = await svc.from("exams").select("id,status").eq("id", examId).single();
    if (ex.error) return NextResponse.json({ error: ex.error.message }, { status: 404 });

    const upd = await svc
      .from("exams")
      .update({ status: "archived" })
      .eq("id", examId)
      .select("*")
      .single();
    
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
    
    return NextResponse.json({ item: upd.data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}