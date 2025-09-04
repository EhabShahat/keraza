import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/ip";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const code: string | null = body?.code ?? null;
    const studentName: string | null = body?.studentName ?? null;
    const deviceInfo: any | null = body?.deviceInfo ?? null;
    const hdrs = await headers();
    const ip = getClientIp(hdrs);

    const supabase = supabaseServer();

    // Get student data if code is provided (for mobile number blocking check)
    let studentData = null;
    if (code) {
      const { data } = await supabase
        .from("students")
        .select("student_name, mobile_number")
        .eq("code", code)
        .single();
      studentData = data;
    }

    // Check if IP, student name, or mobile number is blocked (Easter Egg feature)
    const blockedChecks = [];
    if (ip) {
      blockedChecks.push(
        supabase
          .from("blocked_entries")
          .select("value, reason")
          .eq("type", "ip")
          .eq("value", ip)
          .single()
      );
    }
    if (studentName) {
      blockedChecks.push(
        supabase
          .from("blocked_entries")
          .select("value, reason")
          .eq("type", "name")
          .ilike("value", studentName.trim())
          .single()
      );
    }
    if (studentData?.mobile_number) {
      blockedChecks.push(
        supabase
          .from("blocked_entries")
          .select("value, reason")
          .eq("type", "mobile")
          .eq("value", studentData.mobile_number.trim())
          .single()
      );
    }

    if (blockedChecks.length > 0) {
      const results = await Promise.all(blockedChecks);
      const blocked = results.find(result => result.data && !result.error);
      
      if (blocked?.data) {
        return NextResponse.json(
          { 
            error: "access_denied",
            message: blocked.data.reason || "Access has been restricted for this entry."
          },
          { status: 403 }
        );
      }
    }
    const { data, error } = await supabase.rpc("start_attempt_v2", {
      p_exam_id: examId,
      p_code: code,
      p_student_name: studentName,
      p_ip: ip,
    });
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    const attemptId: string | undefined = row?.attempt_id;
    if (!attemptId) {
      return NextResponse.json({ error: "no_attempt" }, { status: 400 });
    }

    // Best-effort: store device metadata if provided
    if (deviceInfo && typeof deviceInfo === "object") {
      try {
        await supabase
          .from("exam_attempts")
          .update({ device_info: deviceInfo })
          .eq("id", attemptId);
      } catch (e) {
        console.warn("device_info update failed", e);
      }
    }

    // Get student name for the response (reuse studentData if already fetched)
    let finalStudentName = studentName;
    if (code && studentData?.student_name) {
      finalStudentName = studentData.student_name;
    } else if (code && !studentData) {
      // Fallback if studentData wasn't fetched earlier
      const { data: fallbackData } = await supabase
        .from("students")
        .select("student_name")
        .eq("code", code)
        .single();
      
      if (fallbackData?.student_name) {
        finalStudentName = fallbackData.student_name;
      }
    }

    // Set a session cookie with attemptId
    const cookieStore = await cookies();
    cookieStore.set("attemptId", attemptId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only secure in production (HTTPS)
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 3, // 3h safe default
    });

    return NextResponse.json({ 
      attemptId,
      studentName: finalStudentName 
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
