import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseServer();
    
    // Test basic database connection
    const { data: testData, error: testError } = await supabase
      .from("exams")
      .select("id, title, status")
      .limit(1);
    
    if (testError) {
      return NextResponse.json({ 
        error: "Database connection failed", 
        details: testError.message 
      }, { status: 500 });
    }

    // Test if we can call the start_attempt_v2 function with a dummy call
    // This will fail but should give us info about what's wrong
    const { data: rpcData, error: rpcError } = await supabase.rpc("start_attempt_v2", {
      p_exam_id: "00000000-0000-0000-0000-000000000000", // Dummy UUID
      p_code: null,
      p_student_name: "test",
      p_ip: "127.0.0.1"
    });

    return NextResponse.json({
      success: true,
      database_connection: "OK",
      exams_found: testData?.length || 0,
      rpc_test: {
        error: rpcError?.message || "No error",
        data: rpcData
      }
    });

  } catch (e: any) {
    return NextResponse.json({
      error: "Test failed",
      message: e?.message || "Unknown error"
    }, { status: 500 });
  }
}