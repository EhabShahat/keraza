import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    
    // Get students with their exam attempt statistics
    const { data, error } = await svc
      .from("student_exam_summary")
      .select("*")
      .order("student_created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ students: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const body = await req.json();
    
    const { student_name, mobile_number, code } = body;
    
    // Generate code if not provided
    let finalCode = code;
    if (!finalCode) {
      // Generate a unique 4-digit numeric code
      let attempts = 0;
      do {
        finalCode = Math.floor(1000 + Math.random() * 9000).toString();
        attempts++;
        if (attempts > 100) {
          throw new Error("Failed to generate unique code");
        }
        
        const { data: existing } = await svc
          .from("students")
          .select("id")
          .eq("code", finalCode)
          .maybeSingle();
          
        if (!existing) break;
      } while (true);
    }
    
    // Check if code already exists
    const { data: existing } = await svc
      .from("students")
      .select("id")
      .eq("code", finalCode)
      .maybeSingle();
      
    if (existing) {
      return NextResponse.json({ error: "Code already exists" }, { status: 400 });
    }
    
    // Create the student
    const { data, error } = await svc
      .from("students")
      .insert({
        code: finalCode,
        student_name: student_name || null,
        mobile_number: mobile_number || null,
      })
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