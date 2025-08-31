import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    await requireAdmin(req);
    const { attemptId } = await ctx.params;

    const token = await getBearerToken(req);
    const supabase = supabaseServer(token || undefined);

    // Base state (does not include correct_answers)
    const { data: state, error } = await supabase.rpc("get_attempt_state", {
      p_attempt_id: attemptId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Determine exam_id
    const examId: string | null = state?.exam?.id ?? null;
    let ensuredExamId = examId;
    if (!ensuredExamId) {
      const att = await supabase
        .from("exam_attempts")
        .select("exam_id")
        .eq("id", attemptId)
        .maybeSingle();
      if (att.error) return NextResponse.json({ error: att.error.message }, { status: 400 });
      ensuredExamId = att.data?.exam_id ?? null;
    }

    // Fetch questions with correct_answers for admin grading
    if (ensuredExamId) {
      const qRes = await supabase
        .from("questions")
        .select("id, question_text, question_type, options, points, required, order_index, correct_answers, created_at")
        .eq("exam_id", ensuredExamId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (!qRes.error && Array.isArray(qRes.data)) {
        // Replace questions array with admin-enriched version
        const adminQuestions = qRes.data.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          points: q.points,
          required: q.required,
          order_index: q.order_index,
          correct_answers: q.correct_answers,
        }));
        const enriched = { ...(state ?? {}), questions: adminQuestions };
        return NextResponse.json(enriched);
      }
      if (qRes.error) {
        // Fall back to original state (without correct answers) if questions fetch fails
        // eslint-disable-next-line no-console
        console.warn("Admin state questions fetch failed:", qRes.error.message);
      }
    }

    return NextResponse.json(state);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
