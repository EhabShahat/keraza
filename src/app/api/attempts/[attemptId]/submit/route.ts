import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const supabase = supabaseServer();
    const { attemptId } = await ctx.params;
    const { data, error } = await supabase.rpc("submit_attempt", {
      p_attempt_id: attemptId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      total_questions: row?.total_questions ?? 0,
      correct_count: row?.correct_count ?? 0,
      score_percentage: row?.score_percentage ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
