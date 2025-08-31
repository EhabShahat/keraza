import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(_req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(_req);
    const svc = supabaseServer(token || undefined);
    const { data, error } = await svc.from("exams").select("*").eq("id", examId).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ item: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // If updating to published, archive any other published exams first
    if (body && body.status === "published") {
      const unpub = await svc
        .from("exams")
        .update({ status: "archived" })
        .eq("status", "published")
        .neq("id", examId);
      if (unpub.error) return NextResponse.json({ error: unpub.error.message }, { status: 400 });
    }

    const { data, error } = await svc
      .from("exams")
      .update(body)
      .eq("id", examId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { error } = await svc.from("exams").delete().eq("id", examId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
