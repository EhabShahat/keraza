import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await ctx.params;
    const supabase = supabaseServer();
    
    const { data, error } = await supabase
      .from("exams")
      .select("id, title, description, access_type, start_time, end_time, duration_minutes, status")
      .eq("id", examId)
      .eq("status", "published")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}