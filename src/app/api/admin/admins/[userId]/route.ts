import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await ctx.params;
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const res = await svc.rpc("admin_remove_admin", { p_user_id: userId });
    if (res.error) {
      const msg = (res.error.message || "").toLowerCase();
      if (msg.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      if (msg.includes("cannot_remove_last_admin")) return NextResponse.json({ error: "cannot_remove_last_admin" }, { status: 400 });
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await ctx.params;
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim();
    if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const res = await svc.rpc("admin_update_admin_email", { p_user_id: userId, p_email: email });
    if (res.error) {
      const msg = (res.error.message || "").toLowerCase();
      if (msg.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      if (msg.includes("invalid_email")) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
      if (msg.includes("admin_not_found")) return NextResponse.json({ error: "admin_not_found" }, { status: 404 });
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
    return NextResponse.json({ item: (res.data && res.data[0]) || null });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
