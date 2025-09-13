import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const { message } = await req.json();

    // Set system disabled flag
    const disableResult = await svc
      .from("app_config")
      .upsert({
        key: "system_disabled",
        value: "true",
        updated_at: new Date().toISOString(),
      });

    if (disableResult.error) {
      return NextResponse.json({ error: disableResult.error.message }, { status: 400 });
    }

    // Set disable message
    const messageResult = await svc
      .from("app_config")
      .upsert({
        key: "system_disabled_message",
        value: message || "No exams are currently available. Please check back later.",
        updated_at: new Date().toISOString(),
      });

    if (messageResult.error) {
      return NextResponse.json({ error: messageResult.error.message }, { status: 400 });
    }

    // Archive any published exams
    const archiveResult = await svc
      .from("exams")
      .update({ status: "archived" })
      .eq("status", "published");

    if (archiveResult.error) {
      return NextResponse.json({ error: archiveResult.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}