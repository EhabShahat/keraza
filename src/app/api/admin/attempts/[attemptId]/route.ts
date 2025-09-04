import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { auditLog } from "@/lib/audit";

<<<<<<< HEAD
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    await requireAdmin(request);
    const { attemptId } = await params;

    if (!attemptId) {
      return NextResponse.json(
        { error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("exam_attempts")
      .select(
        "id, student_name, ip_address, completion_status, started_at, submitted_at, device_info, students(student_name)"
      )
      .eq("id", attemptId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const item = {
      id: (data as any).id,
      student_name:
        (data as any).students?.student_name ?? (data as any).student_name ?? null,
      completion_status: (data as any).completion_status ?? null,
      started_at: (data as any).started_at ?? null,
      submitted_at: (data as any).submitted_at ?? null,
      ip_address: (data as any).ip_address ?? null,
      device_info: (data as any).device_info ?? null,
      // Placeholder for IP history; UI will handle empty array gracefully
      ips: [] as Array<{ created_at: string; ip_address: string }>,
    };

    return NextResponse.json({ item });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

=======
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
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
<<<<<<< HEAD
      .from("exam_attempts")
      .select(`
        id,
        exam_id,
        student_id,
        student_name,
=======
      .from("attempts")
      .select(`
        id,
        student_name,
        student_email,
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
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

<<<<<<< HEAD
    // Best-effort: remove gating row tied to this attempt_id before deleting the attempt.
    // This covers legacy attempts where exam_attempts.student_id may be null.
    {
      const { error: preDelGatingErr } = await supabase
        .from("student_exam_attempts")
        .delete()
        .eq("attempt_id", attemptId);
      if (preDelGatingErr) {
        console.error("Pre-delete gating removal failed:", preDelGatingErr);
      }
    }

    // Delete the attempt (this will cascade to related records)
    const { error: deleteError } = await supabase
      .from("exam_attempts")
=======
    // Delete the attempt (this will cascade to related records)
    const { error: deleteError } = await supabase
      .from("attempts")
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
      .delete()
      .eq("id", attemptId);

    if (deleteError) {
      console.error("Delete attempt error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete attempt" },
        { status: 500 }
      );
    }

<<<<<<< HEAD
    // If this attempt belonged to a student (code-based access), reset per-exam gating
    if ((attempt as any).student_id && (attempt as any).exam_id) {
      const studentId = (attempt as any).student_id as string;
      const examId = (attempt as any).exam_id as string;

      const { data: resetRows, error: resetError } = await supabase.rpc(
        "admin_reset_student_attempts",
        {
          p_student_id: studentId,
          p_exam_id: examId,
        }
      );

      const deletedCount = Array.isArray(resetRows)
        ? Number((resetRows[0] as any)?.deleted_count ?? 0)
        : 0;

      if (resetError || deletedCount === 0) {
        if (resetError) {
          console.warn("admin_reset_student_attempts error:", resetError);
        } else {
          console.log("admin_reset_student_attempts: no rows deleted (likely pre-delete removal handled it)");
        }
        // Fallback: attempt direct delete in case RPC is missing or not applied
        const { error: directDelErr } = await supabase
          .from("student_exam_attempts")
          .delete()
          .match({ student_id: studentId, exam_id: examId });
        if (directDelErr) {
          console.error("Direct gating reset failed:", directDelErr);
        }
      } else {
        console.log("Gating reset via RPC, deleted_count=", deletedCount);
      }
    }

=======
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
    // Log the admin action
    await auditLog(admin.user_id, "delete_attempt", {
      resource_type: "attempt",
      resource_id: attemptId,
      student_name: attempt.student_name,
<<<<<<< HEAD
=======
      student_email: attempt.student_email,
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
      exam_title: (attempt.exam as any)?.title,
    });

    return NextResponse.json({ success: true });
<<<<<<< HEAD
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("Delete attempt error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
=======
  } catch (error) {
    console.error("Delete attempt error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a
      { status: 500 }
    );
  }
}