import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function coerceArray(val: any): any[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [];
}

async function readBody(req: NextRequest): Promise<any> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      return await req.json();
    }
    const text = await req.text();
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  } catch {
    return {};
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const body = await readBody(req);
    const events: any[] = coerceArray(
      Array.isArray(body) ? body : body?.events ?? body?.batch
    );

    const { attemptId } = await ctx.params;

    if (!attemptId) {
      return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });
    }

    if (!Array.isArray(events) || events.length === 0) {
      // Accept no-op to allow beacon calls not to fail
      return NextResponse.json({ inserted_count: 0 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase.rpc("log_attempt_activity", {
      p_attempt_id: attemptId,
      p_events: events,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ inserted_count: row?.inserted_count ?? 0 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
