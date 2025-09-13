import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(_req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(_req);
    const svc = supabaseServer(token || undefined);
    const { data, error } = await svc
      .from("questions")
      .select("*")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true, nullsFirst: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    if (Array.isArray(body?.items)) {
      const toInsert = body.items.map((q: any) => ({ ...q, exam_id: examId }));
      const { data, error } = await svc.from("questions").insert(toInsert).select("*");
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ items: data });
    } else {
      const q = { ...body, exam_id: examId };
      const { data, error } = await svc.from("questions").insert(q).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ item: data });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
