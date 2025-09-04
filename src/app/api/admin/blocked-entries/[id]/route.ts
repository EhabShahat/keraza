import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { auditLog } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Get entry details for logging
    const { data: entry, error: fetchError } = await supabase
      .from("blocked_entries")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !entry) {
      return NextResponse.json(
        { error: "Blocked entry not found" },
        { status: 404 }
      );
    }

    // Delete the entry
    const { error: deleteError } = await supabase
      .from("blocked_entries")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete blocked entry error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete blocked entry" },
        { status: 500 }
      );
    }

    // Log the admin action
    await auditLog(admin.user_id, "unblock_entry", {
      resource_type: "blocked_entry",
      resource_id: id,
      type: entry.type,
      value: entry.value,
      reason: entry.reason,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete blocked entry error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}