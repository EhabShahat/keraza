import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const svc = supabaseServer();

    // Read search term (required to return any results)
    const searchTerm = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (!searchTerm) {
      return NextResponse.json({ items: [] });
    }

    // Determine effective search mode from admin settings
    // Fallback to name-search if settings/columns are missing
    let mode: "name" | "code" = "name";
    try {
      console.log("Fetching search mode settings");
      const { data: settings, error: settingsError } = await svc
        .from("app_settings")
        .select("enable_name_search, enable_code_search")
        .limit(1)
        .maybeSingle();
        
      if (settingsError) {
        console.warn("Error fetching settings, defaulting to name search:", settingsError);
      } else {
        console.log("Settings retrieved:", settings);
        const enableName = (settings as any)?.enable_name_search !== false;
        const enableCode = (settings as any)?.enable_code_search !== false;
        mode = enableCode && !enableName ? "code" : "name";
        console.log(`Search mode set to: ${mode}`);
      }
    } catch (error) {
      console.error("Exception in settings retrieval, defaulting to name search:", error);
      // ignore settings errors and default to name
    }

    // Build query joining necessary data. Only include attempts that have results.
    // Extra guard: if code mode but input isn't 4 digits, short-circuit with empty list
    if (mode === "code") {
      const trimmed = searchTerm.trim();
      if (!/^\d{4}$/.test(trimmed)) {
        console.log("Code mode but non-4-digit input; returning empty");
        return NextResponse.json({ items: [] });
      }
    }

    let query;
    if (mode === "name") {
      // Name mode via global students joined through exam_attempts.student_id
      query = svc
        .from("exam_attempts")
        .select(
          `id, exam_id, completion_status, submitted_at,
           exams(title, settings),
           students(student_name, code),
           exam_results!inner(score_percentage)`
        )
        .order("submitted_at", { ascending: false })
        .ilike("students.student_name", `%${searchTerm}%`);
    } else {
      // Code mode using global students through student_exam_attempts
      const code = searchTerm.trim();
      query = svc
        .from("exam_attempts")
        .select(
          `id, exam_id, completion_status, submitted_at,
           exams(title, settings),
           exam_results!inner(score_percentage),
           student_exam_attempts!inner(
             students!inner(student_name, code)
           )`
        )
        .order("submitted_at", { ascending: false })
        .eq("student_exam_attempts.students.code", code);
    }

    console.log(`Executing query with mode: ${mode}, searchTerm: ${searchTerm}`);
    const { data, error } = await query;
    if (error) {
      console.error("Error fetching filtered results:", error);
      
      // Check for specific error types and provide appropriate responses
      if (error.code === "42P01") { // Table doesn't exist
        console.log("Table doesn't exist, returning empty results");
        return NextResponse.json({ items: [], message: "No results available" });
      } else if (error.code === "42703") { // Column doesn't exist
        console.log("Column error, returning empty results");
        return NextResponse.json({ items: [], message: "Search is temporarily unavailable" });
      }
      
      return NextResponse.json({ error: "Failed to fetch exam results" }, { status: 500 });
    }
    
    console.log(`Query returned ${data?.length || 0} results`);

    const items = (data || []).map((row: any) => {
      // derive student info depending on mode and join shape (object vs array)
      let student_name = "Anonymous";
      let student_code = "";
      if (mode === "code") {
        const sea = row.student_exam_attempts;
        const seaObj = Array.isArray(sea) ? sea[0] : sea;
        const stu = seaObj?.students;
        const stuObj = Array.isArray(stu) ? stu[0] : stu;
        student_name = stuObj?.student_name || student_name;
        student_code = stuObj?.code || student_code;
      } else {
        const stu = row.students;
        const stuObj = Array.isArray(stu) ? stu[0] : stu;
        student_name = stuObj?.student_name || student_name;
        student_code = stuObj?.code || student_code;
      }
      // compute pass/fail based on exam.settings.pass_percentage
      const rawScore = row.exam_results?.score_percentage;
      const score_percentage = rawScore === null || rawScore === undefined ? null : Number(rawScore);
      const passThresholdRaw = row.exams?.settings?.pass_percentage;
      const pass_threshold = passThresholdRaw === null || passThresholdRaw === undefined ? null : Number(passThresholdRaw);
      const is_pass = (typeof score_percentage === 'number' && !Number.isNaN(score_percentage) && typeof pass_threshold === 'number' && !Number.isNaN(pass_threshold))
        ? score_percentage >= pass_threshold
        : null;
      return {
        id: row.id,
        exam_id: row.exam_id,
        exam_title: row.exams?.title || "Unknown Exam",
        student_name,
        student_code,
        completion_status: row.completion_status,
        submitted_at: row.submitted_at,
        score_percentage,
        pass_threshold,
        is_pass,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Unexpected error in results API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}