import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

// This API reads/writes a single-row settings table if present.
// If not configured in DB, returns { error: "not_configured" } with 501.

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(process.env.SUPABASE_SERVICE_ROLE_KEY ? undefined : (token || undefined));
    // Try single-row table approach
    const { data, error } = await svc.from("app_settings").select("*").limit(1).maybeSingle();
    if (error?.code === "42P01" /* undefined_table */) {
      return NextResponse.json({ error: "not_configured" }, { status: 501 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data || null });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(process.env.SUPABASE_SERVICE_ROLE_KEY ? undefined : (token || undefined));
    const payload = await req.json();

    // If table missing, indicate to configure DB
    const { data: existing, error: selErr } = await svc.from("app_settings").select("id").limit(1).maybeSingle();
    if (selErr?.code === "42P01") {
      return NextResponse.json({ error: "not_configured" }, { status: 501 });
    }
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });

    if (!existing) {
      const { data, error } = await svc.from("app_settings").insert([{ ...payload }]).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ item: data });
    } else {
      const { data, error } = await svc.from("app_settings").update({ ...payload }).eq("id", existing.id).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ item: data });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
