import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const { answers, auto_save_data, expected_version } = body || {};

    const supabase = supabaseServer();
    const { attemptId } = await ctx.params;
    const { data, error } = await supabase.rpc("save_attempt", {
      p_attempt_id: attemptId,
      p_answers: answers ?? {},
      p_auto_save_data: auto_save_data ?? {},
      p_expected_version: expected_version ?? 1,
    });

    if (error) {
      if (error.message && error.message.includes("version_mismatch")) {
        const latest = await supabase.rpc("get_attempt_state", {
          p_attempt_id: attemptId,
        });
        return NextResponse.json(
          { error: "version_mismatch", latest: latest.data },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ new_version: row?.new_version ?? null });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
