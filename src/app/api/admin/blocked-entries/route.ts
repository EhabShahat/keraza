import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { auditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("blocked_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch blocked entries error:", error);
      return NextResponse.json(
        { error: "Failed to fetch blocked entries" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Get blocked entries error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/admin/blocked-entries - Starting request");
    
    // Step 1: Check admin authentication
    let admin;
    try {
      admin = await requireAdmin(request);
      console.log("Admin authenticated:", { user_id: admin.user_id, email: admin.email });
    } catch (authError) {
      console.error("Authentication failed:", authError);
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    // Step 2: Parse request body
    let body;
    try {
      body = await request.json();
      console.log("Request body:", body);
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { type, value, reason } = body;

    // Step 3: Validate input
    if (!type || !value) {
      console.log("Missing required fields:", { type, value });
      return NextResponse.json(
        { error: "Type and value are required" },
        { status: 400 }
      );
    }

    if (!["name", "ip", "mobile"].includes(type)) {
      console.log("Invalid type:", type);
      return NextResponse.json(
        { error: "Type must be 'name', 'ip', or 'mobile'" },
        { status: 400 }
      );
    }

    // Step 4: Initialize Supabase
    let supabase;
    try {
      supabase = supabaseServer();
      console.log("Supabase client initialized");
    } catch (supabaseError) {
      console.error("Failed to initialize Supabase:", supabaseError);
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    // Step 5: Check if entry already exists
    try {
      const { data: existing, error: existingError } = await supabase
        .from("blocked_entries")
        .select("id")
        .eq("type", type)
        .eq("value", value.trim())
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is expected
        console.error("Error checking existing entry:", existingError);
        return NextResponse.json(
          { error: "Database error while checking existing entries" },
          { status: 500 }
        );
      }

      if (existing) {
        console.log("Entry already exists:", existing);
        return NextResponse.json(
          { error: "This entry is already blocked" },
          { status: 409 }
        );
      }
    } catch (checkError) {
      console.error("Exception while checking existing entry:", checkError);
      return NextResponse.json(
        { error: "Failed to check existing entries" },
        { status: 500 }
      );
    }

    // Step 6: Add new blocked entry
    let data;
    try {
      const insertResult = await supabase
        .from("blocked_entries")
        .insert({
          type,
          value: value.trim(),
          reason: reason?.trim() || null,
          created_by: admin.email || admin.user_id,
        })
        .select()
        .single();

      if (insertResult.error) {
        console.error("Insert error:", insertResult.error);
        return NextResponse.json(
          { error: `Database insert failed: ${insertResult.error.message}` },
          { status: 500 }
        );
      }

      data = insertResult.data;
      console.log("Successfully inserted blocked entry:", data);
    } catch (insertError) {
      console.error("Exception during insert:", insertError);
      return NextResponse.json(
        { error: "Failed to insert blocked entry" },
        { status: 500 }
      );
    }

    // Step 7: Log the admin action (non-blocking)
    try {
      await auditLog(admin.user_id, "block_entry", {
        resource_type: "blocked_entry",
        resource_id: data.id,
        type,
        value: value.trim(),
        reason: reason?.trim(),
      });
      console.log("Audit log recorded");
    } catch (auditError) {
      console.error("Audit log failed (non-blocking):", auditError);
      // Don't fail the request if audit logging fails
    }

    console.log("POST /api/admin/blocked-entries - Success");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected error in POST /api/admin/blocked-entries:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}