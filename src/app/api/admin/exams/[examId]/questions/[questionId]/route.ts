import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ examId: string; questionId: string }> }) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { examId, questionId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { data, error } = await svc
      .from("questions")
      .update({ ...body, exam_id: examId })
      .eq("id", questionId)
      .eq("exam_id", examId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ examId: string; questionId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId, questionId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { error } = await svc
      .from("questions")
      .delete()
      .eq("id", questionId)
      .eq("exam_id", examId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
