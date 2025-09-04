import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Get all exams with question counts
    const examsQuery = await svc
      .from("exams")
      .select(`
        *,
        questions(count),
        exam_attempts(count)
      `)
      .order("created_at", { ascending: false });

    if (examsQuery.error) {
      console.error("Exams query error:", examsQuery.error);
      return NextResponse.json({ error: examsQuery.error.message }, { status: 400 });
    }

    const exams = examsQuery.data.map(exam => ({
      ...exam,
      question_count: exam.questions?.[0]?.count || 0,
      attempt_count: exam.exam_attempts?.[0]?.count || 0,
    }));

    // Find active exam
    const activeExam = exams.find(exam => exam.status === 'published') || null;

    // Get system status from app_config (tri-state mode)
    const configKeys = ["system_disabled", "system_disabled_message", "system_mode"] as const;
    const configQuery = await svc
      .from("app_config")
      .select("key, value")
      .in("key", configKeys as unknown as string[]);

    if (configQuery.error) {
      console.warn("Config query error:", configQuery.error);
    }

    const configMap = new Map<string, string>();
    for (const row of configQuery.data || []) {
      configMap.set((row as any).key, (row as any).value);
    }

    const legacyDisabled = configMap.get("system_disabled") === "true";
    const mode = (configMap.get("system_mode") as 'exam' | 'results' | 'disabled' | undefined) || (legacyDisabled ? 'disabled' : 'exam');
    const systemStatus = {
      mode,
      isDisabled: mode === 'disabled',
      disableMessage: configMap.get("system_disabled_message") || 'No exams are currently available. Please check back later.',
    } as { mode: 'exam' | 'results' | 'disabled'; isDisabled: boolean; disableMessage: string };

    // Get stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeAttemptsQuery = await svc
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .is("submitted_at", null);

    const completedTodayQuery = await svc
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .not("submitted_at", "is", null)
      .gte("submitted_at", today.toISOString());

    const stats = {
      totalExams: exams.length,
      activeAttempts: activeAttemptsQuery.count || 0,
      completedToday: completedTodayQuery.count || 0,
    };

    // Set cache control headers to prevent aborted requests
    return new NextResponse(
      JSON.stringify({
        exams,
        activeExam,
        stats,
        systemStatus,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}