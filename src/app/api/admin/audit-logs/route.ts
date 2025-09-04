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

    // Get unique user IDs
    const userIds = [...new Set(auditData?.map(log => log.user_id).filter(Boolean) || [])];
    
    // Fetch user data separately from auth.users
    let userData: any[] = [];
    if (userIds.length > 0) {
      const { data: users } = await svc.auth.admin.listUsers();
      userData = users?.users?.filter(user => userIds.includes(user.id)) || [];
    }

    // Merge the data
    const enrichedData = auditData?.map(log => ({
      ...log,
      users: log.user_id ? userData.find(user => user.id === log.user_id) : null
    })) || [];

    return NextResponse.json({ items: enrichedData });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
