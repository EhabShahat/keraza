import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Try RPC first
    let rows: any[] | null = null;
    const rpc = await svc.rpc("admin_list_attempts", { p_exam_id: examId });
    if (!rpc.error && Array.isArray(rpc.data)) {
      rows = rpc.data as any[];
    }
    if (rpc.error) {
      // eslint-disable-next-line no-console
      console.warn("admin_list_attempts RPC failed (export), using fallback query:", rpc.error.message || rpc.error);
    }

    if (!rows) {
      // Fallback: join exam_attempts with students and exam_results to include score
      const fb = await svc
        .from("exam_attempts")
        .select("id, exam_id, ip_address, started_at, submitted_at, completion_status, students(student_name, code), exam_results(score_percentage)")
        .eq("exam_id", examId)
        .order("started_at", { ascending: false, nullsFirst: true });
      if (fb.error) return NextResponse.json({ error: fb.error.message }, { status: 400 });
      rows = (fb.data ?? []).map((a: any) => ({
        id: a.id,
        exam_id: a.exam_id,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        completion_status: a.completion_status,
        ip_address: a.ip_address,
        student_name: a?.students?.student_name ?? a?.student_name ?? null,
        score_percentage: a?.exam_results?.score_percentage ?? null,
      }));
    }

    const headers = [
      "id",
      "student_name",
      "completion_status",
      "started_at",
      "submitted_at",
      "ip_address",
      "score_percentage",
    ];

    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes("\"") || s.includes(",") || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines: string[] = [];
    lines.push(headers.join(","));
    for (const r of rows) {
      lines.push([
        esc(r.id),
        esc(r.student_name),
        esc(r.completion_status),
        esc(r.started_at),
        esc(r.submitted_at),
        esc(r.ip_address),
        esc(r.score_percentage ?? ""),
      ].join(","));
    }
    const csv = lines.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=attempts_${examId}.csv`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
