import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const url = new URL(req.url);
    const q = url.searchParams.get("q");

    let query = svc.from("exams").select("*" as const).order("start_time", { ascending: true, nullsFirst: true });
    if (q) query = query.ilike("title", `%${q}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: data });
  } catch (e: any) {
    if (e instanceof Response) return e; // from requireAdmin
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const {
      title,
      description = null,
      start_time,
      end_time,
      duration_minutes,
      status = "draft",
      access_type = "open",
      settings = {},
    } = body || {};

    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Multiple published exams are allowed; do not auto-archive other exams.

    const { data, error } = await svc
      .from("exams")
      .insert({ title, description, start_time, end_time, duration_minutes, status, access_type, settings })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
