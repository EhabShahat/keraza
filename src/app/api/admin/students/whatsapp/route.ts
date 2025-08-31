import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const body = await req.json();
    
    const { studentIds, message } = body;
    
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "No students selected" }, { status: 400 });
    }
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    
    // Get students with mobile numbers
    const { data: students, error: studentsError } = await svc
      .from("students")
      .select("id, code, student_name, mobile_number")
      .in("id", studentIds)
      .not("mobile_number", "is", null);
    
    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 400 });
    }
    
    if (!students || students.length === 0) {
      return NextResponse.json({ error: "No students found with mobile numbers" }, { status: 400 });
    }
    
    // Generate WhatsApp URLs for each student
    const results = students.map(student => {
      const personalizedMessage = message
        .replace(/\{code\}/g, student.code || '')
        .replace(/\{name\}/g, student.student_name || '');
      
      const encodedMessage = encodeURIComponent(personalizedMessage);
      const whatsappUrl = `https://wa.me/${student.mobile_number}?text=${encodedMessage}`;
      
      return {
        student_id: student.id,
        student_name: student.student_name,
        mobile_number: student.mobile_number,
        whatsapp_url: whatsappUrl,
        message: personalizedMessage
      };
    });
    
    // Log the WhatsApp send action
    await svc.from("audit_logs").insert({
      actor: "admin",
      action: "whatsapp_send_global_students",
      meta: {
        student_count: results.length,
        message_template: message,
        timestamp: new Date().toISOString()
      }
    });
    
    return NextResponse.json({ 
      success: true,
      results,
      message: `WhatsApp URLs generated for ${results.length} students`
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}