import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { auditLog } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { attemptId } = await params;

    if (!attemptId) {
      return NextResponse.json(
        { error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // First, get the attempt details for logging
    const { data: attempt, error: fetchError } = await supabase
      .from("attempts")
      .select(`
        id,
        student_name,
        student_email,
        exam:exams(title)
      `)
      .eq("id", attemptId)
      .single();

    if (fetchError || !attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    // Delete the attempt (this will cascade to related records)
    const { error: deleteError } = await supabase
      .from("attempts")
      .delete()
      .eq("id", attemptId);

    if (deleteError) {
      console.error("Delete attempt error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete attempt" },
        { status: 500 }
      );
    }

    // Log the admin action
    await auditLog(admin.user_id, "delete_attempt", {
      resource_type: "attempt",
      resource_id: attemptId,
      student_name: attempt.student_name,
      student_email: attempt.student_email,
      exam_title: (attempt.exam as any)?.title,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete attempt error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}