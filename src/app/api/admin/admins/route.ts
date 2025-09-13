import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const res = await svc.rpc("admin_list_admins");
    if (res.error) {
      const msg = (res.error.message || "").toLowerCase();
      if (msg.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
    return NextResponse.json({ items: res.data || [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim();
    if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const res = await svc.rpc("admin_add_admin_by_email", { p_email: email });
    if (res.error) {
      const msg = (res.error.message || "").toLowerCase();
      if (msg.includes("user_not_found")) return NextResponse.json({ error: "user_not_found" }, { status: 400 });
      if (msg.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
    return NextResponse.json({ item: (res.data && res.data[0]) || null });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
