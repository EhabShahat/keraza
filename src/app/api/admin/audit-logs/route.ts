import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();

    const url = new URL(req.url);
    const actor = url.searchParams.get("actor");
    const action = url.searchParams.get("action");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    let q = svc.from("audit_logs").select("id, actor, action, meta, created_at").order("created_at", { ascending: false });
    if (actor) q = q.ilike("actor", `%${actor}%`);
    if (action) q = q.ilike("action", `%${action}%`);
    if (start) q = q.gte("created_at", start);
    if (end) q = q.lte("created_at", end);

    const { data, error } = await q.range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
