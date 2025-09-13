import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ studentId: string }> }
) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { studentId } = await ctx.params;

    if (!studentId || studentId === "undefined") {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
    }

    let examId: string | undefined = undefined;
    try {
      const body = await req.json();
      if (body && typeof body.examId === "string" && body.examId.trim()) {
        examId = body.examId.trim();
      }
    } catch {
      // ignore if no JSON body
    }

    const { data, error } = await svc.rpc("admin_reset_student_attempts", {
      p_student_id: studentId,
      p_exam_id: examId ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const deleted_count = Array.isArray(data)
      ? (data[0]?.deleted_count ?? 0)
      : (data as any)?.deleted_count ?? 0;

    return NextResponse.json({ deleted_count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
