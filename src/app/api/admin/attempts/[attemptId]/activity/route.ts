import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    await requireAdmin(req);
    const { attemptId } = await ctx.params;
    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 });
    }

    const sp = req.nextUrl.searchParams;
    const eventType = sp.get("event_type"); // optional
    const since = sp.get("since"); // ISO datetime
    const until = sp.get("until"); // ISO datetime
    const limitParam = Number(sp.get("limit") || "200");
    const limit = clamp(isFinite(limitParam) ? Math.trunc(limitParam) : 200, 1, 1000);

    const token = await getBearerToken(req);
    const supabase = supabaseServer(token || undefined);

    let q = supabase
      .from("attempt_activity_events")
      .select("attempt_id, event_type, event_time, payload, created_at")
      .eq("attempt_id", attemptId)
      .order("event_time", { ascending: false })
      .limit(limit);

    if (eventType && eventType !== "all") q = q.eq("event_type", eventType);
    if (since) q = q.gte("event_time", since);
    if (until) q = q.lte("event_time", until);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ items: Array.isArray(data) ? data : [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
