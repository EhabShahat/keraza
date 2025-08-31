import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const supabase = supabaseServer();
    const { attemptId } = await ctx.params;
    const { data, error } = await supabase.rpc("get_attempt_state", {
      p_attempt_id: attemptId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
