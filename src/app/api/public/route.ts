import { NextRequest, NextResponse } from "next/server";
import { UnifiedAPIHandler, APIRequest, APIResponse } from "@/lib/api/unified-handler";
import { supabaseServer } from "@/lib/supabase/server";
import { getCodeFormatSettings, validateCodeFormat } from "@/lib/codeGenerator";
import { getClientIp } from "@/lib/ip";
import { cookies, headers } from "next/headers";
import { 
  getCachedSystemMode, 
  getCachedAppSettings, 
  getCachedCodeSettings, 
  getCachedActiveExams, 
  getCachedExamInfo, 
  getCachedStudentExams 
} from "@/lib/api/public-cache";
import { 
  createCacheHeaderMiddleware, 
  createCacheInvalidationMiddleware 
} from "@/lib/api/cache-middleware";
import {
  createCodeValidationMiddleware,
  createRateLimitMiddleware,
  createIPTrackingMiddleware,
  createAbusePreventionMiddleware,
  createSecurityHeadersMiddleware,
  createRequestValidationMiddleware,
  StudentValidator
} from "@/lib/api/public-security";

/**
 * Consolidated Public API Handler
 * Handles all /api/public/* routes in a single function
 */
class PublicAPIHandler extends UnifiedAPIHandler {
  constructor() {
    super();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Add security middleware first
    this.addGlobalMiddleware(createRequestValidationMiddleware());
    this.addGlobalMiddleware(createSecurityHeadersMiddleware());
    this.addGlobalMiddleware(createIPTrackingMiddleware());
    this.addGlobalMiddleware(createAbusePreventionMiddleware());
    this.addGlobalMiddleware(createRateLimitMiddleware());
    this.addGlobalMiddleware(createCodeValidationMiddleware());
    
    // Add cache-related middleware
    this.addGlobalMiddleware(createCacheHeaderMiddleware());
    this.addGlobalMiddleware(createCacheInvalidationMiddleware());
  }

  private setupRoutes() {
    // System mode endpoint
    this.addRoute({
      path: "system-mode",
      method: "GET",
      handler: this.getSystemMode.bind(this)
    });

    // Public settings endpoint
    this.addRoute({
      path: "settings",
      method: "GET", 
      handler: this.getSettings.bind(this)
    });

    // Code validation endpoint
    this.addRoute({
      path: "validate-code",
      method: "GET",
      handler: this.validateCode.bind(this)
    });

    // Results search endpoint
    this.addRoute({
      path: "results",
      method: "GET",
      handler: this.getResults.bind(this)
    });

    // Code settings endpoint
    this.addRoute({
      path: "code-settings",
      method: "GET",
      handler: this.getCodeSettings.bind(this)
    });

    // Active exam endpoint
    this.addRoute({
      path: "active-exam",
      method: "GET",
      handler: this.getActiveExam.bind(this)
    });

    // Exams by code endpoint
    this.addRoute({
      path: "exams/by-code",
      method: "GET",
      handler: this.getExamsByCode.bind(this)
    });

    // Exam info endpoint
    this.addRoute({
      path: "exams/[examId]/info",
      method: "GET",
      handler: this.getExamInfo.bind(this)
    });

    // Exam access endpoint
    this.addRoute({
      path: "exams/[examId]/access",
      method: "POST",
      handler: this.postExamAccess.bind(this)
    });
  }

  /**
   * GET /api/public/system-mode
   * Returns the current tri-state mode and disabled message for public consumption
   */
  private async getSystemMode(request: APIRequest): Promise<APIResponse> {
    try {
      const result = await getCachedSystemMode();
      return { data: result, status: 200 };
    } catch (e: any) {
      return { data: { mode: "exam", message: null, error: e?.message || "unexpected_error" }, status: 200 };
    }
  }

  /**
   * GET /api/public/settings
   * Returns public application settings
   */
  private async getSettings(request: APIRequest): Promise<APIResponse> {
    try {
      console.log("Public settings API called");
      const result = await getCachedAppSettings();
      console.log("Returning cached settings:", result);
      return { data: result };
    } catch (e: any) {
      console.error("Public settings API error:", e);
      return { error: e?.message || "unexpected_error", status: 500 };
    }
  }

  /**
   * GET /api/public/validate-code
   * Validates student codes and checks availability
   */
  private async validateCode(request: APIRequest): Promise<APIResponse> {
    try {
      const code = request.query.code?.trim() || "";
      const examId = request.query.examId?.trim() || null;

      if (!code) {
        return { data: { valid: false, reason: "missing_code" } };
      }

      // Use the security utility for validation
      const studentValidation = await StudentValidator.validateStudentCode(code);
      
      if (!studentValidation.valid) {
        return { data: { valid: false, reason: studentValidation.reason } };
      }

      // When examId is provided, check if student has already attempted this exam
      if (examId && studentValidation.student) {
        const hasAttempted = await StudentValidator.hasAttempted(studentValidation.student.id, examId);
        
        if (hasAttempted) {
          return { data: { valid: false, reason: "used" } };
        }
      }

      return { data: { valid: true } };
    } catch (e) {
      console.error("Unexpected error in validate-code:", e);
      return { data: { valid: false }, status: 500 };
    }
  }  /**
  
 * GET /api/public/results
   * Search exam results by student name or code
   */
  private async getResults(request: APIRequest): Promise<APIResponse> {
    try {
      const svc = this.getSupabaseClient(request);

      // Read search term (required to return any results)
      const searchTerm = request.query.q?.trim() || "";
      if (!searchTerm) {
        return { data: { items: [] } };
      }

      // Determine effective search mode from admin settings
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
      }

      // Build query joining necessary data. Only include attempts that have results.
      if (mode === "code") {
        const trimmed = searchTerm.trim();
        const codeSettings = await getCodeFormatSettings();
        if (!validateCodeFormat(trimmed, codeSettings)) {
          console.log("Code mode but invalid format input; returning empty");
          return { data: { items: [] } };
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
        if (error.code === "42P01") {
          console.log("Table doesn't exist, returning empty results");
          return { data: { items: [], message: "No results available" } };
        } else if (error.code === "42703") {
          console.log("Column error, returning empty results");
          return { data: { items: [], message: "Search is temporarily unavailable" } };
        }
        
        return { error: "Failed to fetch exam results", status: 500 };
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

      return { data: { items } };
    } catch (error) {
      console.error("Unexpected error in results API:", error);
      return { error: "An unexpected error occurred", status: 500 };
    }
  }

  /**
   * GET /api/public/code-settings
   * Returns code format settings for validation
   */
  private async getCodeSettings(request: APIRequest): Promise<APIResponse> {
    try {
      const settings = await getCachedCodeSettings();
      return { data: settings };
    } catch (error) {
      console.error("Error fetching code settings:", error);
      return {
        data: {
          code_length: 4,
          code_format: "numeric",
          code_pattern: null,
        },
        status: 500
      };
    }
  }

  /**
   * GET /api/public/active-exam
   * Returns active published exams
   */
  private async getActiveExam(request: APIRequest): Promise<APIResponse> {
    try {
      const result = await getCachedActiveExams();
      
      if (result.error) {
        return { 
          error: {
            message: result.error,
            code: result.code,
            details: result.details
          },
          status: 400
        };
      }
      
      return { data: result };
    } catch (e: any) {
      return { error: e?.message || "unexpected_error", status: 500 };
    }
  }

  /**
   * GET /api/public/exams/by-code
   * Returns exams available for a specific student code
   */
  private async getExamsByCode(request: APIRequest): Promise<APIResponse> {
    try {
      const code = request.query.code?.trim() || "";
      
      if (!code) {
        return { data: { valid: false, reason: "missing_code", exams: [] }, status: 400 };
      }

      const result = await getCachedStudentExams(code);
      
      if (result.error) {
        return { data: { valid: false, exams: [], error: result.error }, status: 500 };
      }
      
      if (!result.valid) {
        const status = result.reason === "not_found" ? 404 : 400;
        return { data: result, status };
      }

      return { data: result };
    } catch (e) {
      console.error("Unexpected error in by-code:", e);
      return { data: { valid: false, exams: [] }, status: 500 };
    }
  }

  /**
   * GET /api/public/exams/[examId]/info
   * Returns exam information for a specific exam
   */
  private async getExamInfo(request: APIRequest): Promise<APIResponse> {
    try {
      const examId = this.extractExamId(request.path);
      if (!examId) {
        return { error: "Exam ID is required", status: 400 };
      }

      const result = await getCachedExamInfo(examId);
      
      if (result.error) {
        const status = result.error === "Exam not found" ? 404 : 500;
        return { error: result.error, status };
      }

      return { data: result };
    } catch (e: any) {
      return { error: e?.message || "unexpected_error", status: 500 };
    }
  }

  /**
   * POST /api/public/exams/[examId]/access
   * Handles exam access requests
   */
  private async postExamAccess(request: APIRequest): Promise<APIResponse> {
    try {
      const examId = this.extractExamId(request.path);
      if (!examId) {
        return { error: "Exam ID is required", status: 400 };
      }

      const body = request.body || {};
      const code: string | null = body?.code ?? null;
      const studentName: string | null = body?.studentName ?? null;
      const deviceInfo: any | null = body?.deviceInfo ?? null;
      
      // Get IP from headers
      const ip = getClientIp(request.headers as any);

      const supabase = this.getSupabaseClient(request);

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
          return {
            error: "access_denied",
            data: { message: blocked.data.reason || "Access has been restricted for this entry." },
            status: 403
          };
        }
      }

      const { data, error } = await supabase.rpc("start_attempt_v2", {
        p_exam_id: examId,
        p_code: code,
        p_student_name: studentName,
        p_ip: ip,
      });

      if (error) {
        return { error: error.message, status: 400 };
      }

      const row = Array.isArray(data) ? data[0] : data;
      const attemptId: string | undefined = row?.attempt_id;
      if (!attemptId) {
        return { error: "no_attempt", status: 400 };
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

      // Note: Cookie setting would need to be handled at the Next.js level
      // This is a limitation of the unified handler approach
      return { 
        data: { 
          attemptId,
          studentName: finalStudentName 
        },
        headers: {
          'Set-Cookie': `attemptId=${attemptId}; HttpOnly; Secure=${process.env.NODE_ENV === 'production'}; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 3}`
        }
      };
    } catch (e: any) {
      return { error: e?.message || "unexpected_error", status: 500 };
    }
  }

  /**
   * Extract examId from path segments
   */
  private extractExamId(path: string[]): string | null {
    // Path format: ["exams", "[examId]", "info"] or ["exams", "[examId]", "access"]
    if (path.length >= 2 && path[0] === "exams") {
      return path[1];
    }
    return null;
  }
}

// Create handler instance
const publicHandler = new PublicAPIHandler();

// Export Next.js API route handlers
export async function GET(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return publicHandler.handle(req, context);
}

export async function POST(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return publicHandler.handle(req, context);
}

export async function PUT(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return publicHandler.handle(req, context);
}

export async function DELETE(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return publicHandler.handle(req, context);
}

export async function PATCH(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return publicHandler.handle(req, context);
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 0;