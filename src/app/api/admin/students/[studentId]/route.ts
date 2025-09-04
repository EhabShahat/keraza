import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { studentId } = await ctx.params;
    const body = await req.json();
    
    const { student_name, mobile_number } = body;
    
    const update: any = {};
    if (student_name !== undefined) update.student_name = student_name || null;
    if (mobile_number !== undefined) update.mobile_number = mobile_number || null;
    
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    
    update.updated_at = new Date().toISOString();
    
    const { data, error } = await svc
      .from("students")
      .update(update)
      .eq("id", studentId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ student: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { studentId } = await ctx.params;
    
    const { error } = await svc
      .from("students")
      .delete()
      .eq("id", studentId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}