import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();

    const now = new Date();
    const iso60m = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const iso2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    // Active attempts (started but not submitted, last 2h window)
    const activeQ = await svc
      .from("exam_attempts")
      .select("id, exam_id, ip_address, started_at, students(student_name, code)")
      .is("submitted_at", null)
      .gte("started_at", iso2h)
      .order("started_at", { ascending: false })
      .limit(200);

    if (activeQ.error?.code === "42P01") {
      return NextResponse.json({ error: "not_configured" }, { status: 501 });
    }
    if (activeQ.error) return NextResponse.json({ error: activeQ.error.message }, { status: 400 });
    const active = (activeQ.data ?? []) as any[];

    // Recent submissions (last 60 minutes)
    const recentQ = await svc
      .from("exam_attempts")
      .select("id, exam_id, ip_address, started_at, submitted_at, completion_status, students(student_name, code)")
      .not("submitted_at", "is", null)
      .gte("submitted_at", iso60m)
      .order("submitted_at", { ascending: false })
      .limit(50);

    if (recentQ.error) return NextResponse.json({ error: recentQ.error.message }, { status: 400 });
    const recent = (recentQ.data ?? []) as any[];

    // Collect exam IDs and fetch titles
    const examIds = Array.from(new Set([...active.map(a => a.exam_id), ...recent.map(r => r.exam_id)].filter(Boolean)));
    let examMap: Record<string, any> = {};
    if (examIds.length) {
      const ex = await svc.from("exams").select("id, title").in("id", examIds);
      if (ex.error) return NextResponse.json({ error: ex.error.message }, { status: 400 });
      examMap = Object.fromEntries((ex.data ?? []).map((e: any) => [e.id, e]));
    }

    const active_count = active.length;
    const submissions_last_60m = recent.length;

    // Per-exam active counts
    const running_by_exam_map: Record<string, number> = {};
    for (const a of active) {
      if (!a.exam_id) continue;
      running_by_exam_map[a.exam_id] = (running_by_exam_map[a.exam_id] || 0) + 1;
    }
    const running_by_exam = Object.entries(running_by_exam_map).map(([exam_id, count]) => ({
      exam_id,
      exam_title: examMap[exam_id]?.title ?? "Unknown",
      count,
    })).sort((a, b) => b.count - a.count);

    // Decorate lists with titles
    const active_list = active.map((a) => ({
      id: a.id,
      exam_id: a.exam_id,
      exam_title: examMap[a.exam_id]?.title ?? "Unknown",
      student_name: (a as any)?.students?.student_name ?? (a as any)?.student_name ?? null,
      ip_address: a.ip_address ?? null,
      started_at: a.started_at,
    }));

    const recent_list = recent.map((r) => ({
      id: r.id,
      exam_id: r.exam_id,
      exam_title: examMap[r.exam_id]?.title ?? "Unknown",
      student_name: (r as any)?.students?.student_name ?? (r as any)?.student_name ?? null,
      ip_address: r.ip_address ?? null,
      started_at: r.started_at,
      submitted_at: r.submitted_at,
      completion_status: r.completion_status,
    }));

    return NextResponse.json({
      now: now.toISOString(),
      active_count,
      submissions_last_60m,
      running_by_exam,
      active_list,
      recent_list,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
