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

    // First get audit logs with user_id
    const auditQuery = svc.from("audit_logs").select(`
      id, 
      actor, 
      action, 
      meta, 
      created_at,
      user_id
    `).order("created_at", { ascending: false });
    
    if (actor) auditQuery.ilike("actor", `%${actor}%`);
    if (action) auditQuery.ilike("action", `%${action}%`);
    if (start) auditQuery.gte("created_at", start);
    if (end) auditQuery.lte("created_at", end);

    const { data: auditData, error: auditError } = await auditQuery.range(offset, offset + limit - 1);
    if (auditError) return NextResponse.json({ error: auditError.message }, { status: 400 });

    // Get unique user IDs from actor field (since actor contains user IDs)
    const userIds = [...new Set(auditData?.map(log => log.actor).filter(Boolean) || [])];
    
    // Fetch user data from public.users table
    let userData: any[] = [];
    if (userIds.length > 0) {
      const { data: users } = await svc.from("users").select("id, email, username, display_name").in("id", userIds);
      userData = users || [];
    }

    // Merge the data
    const enrichedData = auditData?.map(log => ({
      ...log,
      users: userData.find(user => user.id === log.actor) || null
    })) || [];

    return NextResponse.json({ items: enrichedData });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
