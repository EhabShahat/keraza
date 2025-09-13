import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/ip";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseServer();
    const hdrs = await headers();
    const clientIp = getClientIp(hdrs);
    
    const { examId } = await req.json();
    
    if (!examId) {
      return NextResponse.json({ error: "examId required" }, { status: 400 });
    }

    // Delete all attempts from this IP for this exam
    const { data, error } = await supabase
      .from("exam_attempts")
      .delete()
      .eq("exam_id", examId)
      .eq("ip_address", clientIp);

    if (error) {
      return NextResponse.json({ 
        error: "Failed to clear attempts", 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cleared all attempts from IP ${clientIp} for exam ${examId}`,
      ip: clientIp
    });

  } catch (e: any) {
    return NextResponse.json({
      error: "Clear attempts failed",
      message: e?.message || "Unknown error"
    }, { status: 500 });
  }
}