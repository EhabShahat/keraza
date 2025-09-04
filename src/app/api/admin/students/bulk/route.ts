import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const body = await req.json();
    
    const { students } = body;
    
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: "No students provided" }, { status: 400 });
    }
    
    // Get existing codes to avoid duplicates
    const { data: existingCodes } = await svc
      .from("students")
      .select("code");
    
    const existingCodeSet = new Set(existingCodes?.map(c => c.code) || []);
    
    const toInsert = [];
    const errors = [];
    
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const { student_name, mobile_number, code } = student;
      
      if (!mobile_number) {
        errors.push(`Row ${i + 1}: Mobile number is required`);
        continue;
      }
      
      let finalCode = code;
      if (!finalCode) {
        // Generate a unique 4-digit numeric code
        let attempts = 0;
        do {
          finalCode = Math.floor(1000 + Math.random() * 9000).toString();
          attempts++;
          if (attempts > 100) {
            errors.push(`Row ${i + 1}: Failed to generate unique code`);
            break;
          }
        } while (existingCodeSet.has(finalCode));
      }
      
      if (existingCodeSet.has(finalCode)) {
        errors.push(`Row ${i + 1}: Code '${finalCode}' already exists`);
        continue;
      }
      
      existingCodeSet.add(finalCode);
      toInsert.push({
        code: finalCode,
        student_name: student_name || null,
        mobile_number: mobile_number,
      });
    }
    
    if (errors.length > 0) {
      return NextResponse.json({ 
        error: "Import errors occurred", 
        details: errors 
      }, { status: 400 });
    }
    
    if (toInsert.length === 0) {
      return NextResponse.json({ 
        error: "No valid students to import" 
      }, { status: 400 });
    }
    
    const { data, error } = await svc
      .from("students")
      .insert(toInsert)
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      students: data,
      created_count: data?.length || 0
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}