import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Load source exam
    const { data: src, error: srcErr } = await svc
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();
    if (srcErr || !src) return NextResponse.json({ error: srcErr?.message || "not_found" }, { status: 404 });

    // Create new exam (status draft, clear dates)
    const insertExam = {
      title: `${src.title} (Copy)`,
      description: src.description,
      start_time: null,
      end_time: null,
      duration_minutes: src.duration_minutes,
      status: "draft",
      access_type: src.access_type,
      settings: src.settings || {},
    } as const;

    const { data: created, error: insErr } = await svc
      .from("exams")
      .insert(insertExam)
      .select("*")
      .single();
    if (insErr || !created) return NextResponse.json({ error: insErr?.message || "insert_failed" }, { status: 400 });

    // Copy questions
    const { data: qs, error: qErr } = await svc
      .from("questions")
      .select("id, question_text, question_type, options, correct_answers, points, required, order_index")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true, nullsFirst: true });
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 400 });

    let inserted = 0;
    if (qs && qs.length > 0) {
      const rows = qs.map((q: any) => ({
        exam_id: created.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options ?? null,
        correct_answers: q.correct_answers ?? null,
        points: q.points ?? 1,
        required: q.required ?? false,
        order_index: q.order_index,
      }));
      const { error: insQErr, count } = await svc
        .from("questions")
        .insert(rows, { count: "exact" });
      if (insQErr) return NextResponse.json({ error: insQErr.message }, { status: 400 });
      inserted = count ?? rows.length;
    }

    return NextResponse.json({ item: created, questions_copied: inserted });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
