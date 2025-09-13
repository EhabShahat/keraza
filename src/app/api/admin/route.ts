import { NextRequest, NextResponse } from "next/server";
import { UnifiedAPIHandler, APIRequest, APIResponse } from "@/lib/api/unified-handler";
import { adminMiddleware } from "@/lib/api/middleware";
import { AdminMiddleware, AdminTokenHandler } from "@/lib/api/admin-auth-middleware";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

/**
 * Consolidated Admin API Handler
 * Consolidates all /api/admin/* routes into a single unified handler
 */
class AdminAPIHandler extends UnifiedAPIHandler {
  constructor() {
    super();
    
    // Add admin-specific middleware
    adminMiddleware.forEach(middleware => this.addGlobalMiddleware(middleware));
    
    // Add admin authentication middleware
    this.addGlobalMiddleware(AdminMiddleware.basic);
    
    // Register all admin routes
    this.registerRoutes();
  }

  private registerRoutes() {
    // Dashboard routes
    this.addRoute({
      path: 'admin/dashboard',
      method: 'GET',
      handler: this.handleDashboard.bind(this),
      middleware: [AdminMiddleware.monitoring]
    });

    // Exam management routes
    this.addRoute({
      path: 'admin/exams',
      method: 'GET',
      handler: this.handleExamsList.bind(this),
      middleware: [AdminMiddleware.examManagement]
    });

    this.addRoute({
      path: 'admin/exams',
      method: 'POST',
      handler: this.handleExamsCreate.bind(this),
      middleware: [AdminMiddleware.examCreate]
    });

    // Student management routes
    this.addRoute({
      path: 'admin/students',
      method: 'GET',
      handler: this.handleStudentsList.bind(this),
      middleware: [AdminMiddleware.studentManagement]
    });

    this.addRoute({
      path: 'admin/students',
      method: 'POST',
      handler: this.handleStudentsCreate.bind(this),
      middleware: [AdminMiddleware.studentCreate]
    });

    // Settings routes
    this.addRoute({
      path: 'admin/settings',
      method: 'GET',
      handler: this.handleSettingsGet.bind(this),
      middleware: [AdminMiddleware.systemSettings]
    });

    this.addRoute({
      path: 'admin/settings',
      method: 'PATCH',
      handler: this.handleSettingsUpdate.bind(this),
      middleware: [AdminMiddleware.systemSettings]
    });

    // Monitoring routes
    this.addRoute({
      path: 'admin/monitoring',
      method: 'GET',
      handler: this.handleMonitoring.bind(this),
      middleware: [AdminMiddleware.monitoring]
    });

    // Whoami route (no special permissions needed)
    this.addRoute({
      path: 'admin/whoami',
      method: 'GET',
      handler: this.handleWhoami.bind(this)
    });

    // Audit logs route
    this.addRoute({
      path: 'admin/audit-logs',
      method: 'GET',
      handler: this.handleAuditLogs.bind(this),
      middleware: [AdminMiddleware.auditLogs]
    });

    // Exam detail routes (with examId parameter)
    this.addRoute({
      path: 'admin/exams/[examId]',
      method: 'GET',
      handler: this.handleExamDetail.bind(this),
      middleware: [AdminMiddleware.examManagement]
    });

    this.addRoute({
      path: 'admin/exams/[examId]',
      method: 'PATCH',
      handler: this.handleExamUpdate.bind(this),
      middleware: [AdminMiddleware.examEdit]
    });

    this.addRoute({
      path: 'admin/exams/[examId]',
      method: 'DELETE',
      handler: this.handleExamDelete.bind(this),
      middleware: [AdminMiddleware.examDelete]
    });

    // Student detail routes (with studentId parameter)
    this.addRoute({
      path: 'admin/students/[studentId]',
      method: 'GET',
      handler: this.handleStudentDetail.bind(this),
      middleware: [AdminMiddleware.studentManagement]
    });

    this.addRoute({
      path: 'admin/students/[studentId]',
      method: 'PATCH',
      handler: this.handleStudentUpdate.bind(this),
      middleware: [AdminMiddleware.studentEdit]
    });

    this.addRoute({
      path: 'admin/students/[studentId]',
      method: 'DELETE',
      handler: this.handleStudentDelete.bind(this),
      middleware: [AdminMiddleware.studentDelete]
    });

    // Bulk operations
    this.addRoute({
      path: 'admin/students/bulk',
      method: 'POST',
      handler: this.handleStudentsBulkCreate.bind(this),
      middleware: [AdminMiddleware.bulkOperations]
    });

    // WhatsApp integration
    this.addRoute({
      path: 'admin/students/whatsapp',
      method: 'POST',
      handler: this.handleStudentsWhatsApp.bind(this),
      middleware: [AdminMiddleware.whatsapp]
    });

    // System administration routes
    this.addRoute({
      path: 'admin/system/mode',
      method: 'POST',
      handler: this.handleSystemMode.bind(this),
      middleware: [AdminMiddleware.systemControl]
    });

    this.addRoute({
      path: 'admin/cleanup-expired',
      method: 'POST',
      handler: this.handleCleanupExpired.bind(this),
      middleware: [AdminMiddleware.systemControl]
    });
  }

  /**
   * Override handle method to integrate existing requireAdmin authentication
   */
  async handle(req: NextRequest, context?: { params?: Promise<Record<string, string>> }): Promise<NextResponse> {
    try {
      // Use existing requireAdmin for authentication
      await requireAdmin(req);
      
      // Continue with unified handler processing
      return super.handle(req, context);
    } catch (error: any) {
      // requireAdmin throws NextResponse for auth failures
      if (error instanceof Response) {
        return error;
      }
      return NextResponse.json({ error: error?.message || "Authentication failed" }, { status: 500 });
    }
  }

  // Dashboard handler
  private async handleDashboard(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);

      // Get all exams with question counts
      const examsQuery = await svc
        .from("exams")
        .select(`
          *,
          questions(count),
          exam_attempts(count)
        `)
        .order("created_at", { ascending: false });

      if (examsQuery.error) {
        console.error("Exams query error:", examsQuery.error);
        return { error: examsQuery.error.message, status: 400 };
      }

      const exams = examsQuery.data.map(exam => ({
        ...exam,
        question_count: exam.questions?.[0]?.count || 0,
        attempt_count: exam.exam_attempts?.[0]?.count || 0,
      }));

      // Find active exam
      const activeExam = exams.find(exam => exam.status === 'published') || null;

      // Get system status from app_config (tri-state mode)
      const configKeys = ["system_disabled", "system_disabled_message", "system_mode"] as const;
      const configQuery = await svc
        .from("app_config")
        .select("key, value")
        .in("key", configKeys as unknown as string[]);

      if (configQuery.error) {
        console.warn("Config query error:", configQuery.error);
      }

      const configMap = new Map<string, string>();
      for (const row of configQuery.data || []) {
        configMap.set((row as any).key, (row as any).value);
      }

      // Get app settings including multi-exam mode
      const appSettingsQuery = await svc
        .from("app_settings")
        .select("enable_multi_exam")
        .limit(1)
        .maybeSingle();

      const appSettings = {
        enable_multi_exam: appSettingsQuery.data?.enable_multi_exam ?? true, // Default to true
      };

      const legacyDisabled = configMap.get("system_disabled") === "true";
      const mode = (configMap.get("system_mode") as 'exam' | 'results' | 'disabled' | undefined) || (legacyDisabled ? 'disabled' : 'exam');
      const systemStatus = {
        mode,
        isDisabled: mode === 'disabled',
        disableMessage: configMap.get("system_disabled_message") || 'No exams are currently available. Please check back later.',
      } as { mode: 'exam' | 'results' | 'disabled'; isDisabled: boolean; disableMessage: string };

      // Get stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeAttemptsQuery = await svc
        .from("exam_attempts")
        .select("id", { count: "exact", head: true })
        .is("submitted_at", null);

      const completedTodayQuery = await svc
        .from("exam_attempts")
        .select("id", { count: "exact", head: true })
        .not("submitted_at", "is", null)
        .gte("submitted_at", today.toISOString());

      const stats = {
        totalExams: exams.length,
        activeAttempts: activeAttemptsQuery.count || 0,
        completedToday: completedTodayQuery.count || 0,
      };

      return {
        data: {
          exams,
          activeExam,
          stats,
          systemStatus,
          appSettings,
        },
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Exams list handler
  private async handleExamsList(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      const q = request.query.q;

      let query = svc.from("exams").select("*" as const).order("start_time", { ascending: true, nullsFirst: true });
      if (q) query = query.ilike("title", `%${q}%`);
      
      const { data, error } = await query;
      if (error) return { error: error.message, status: 400 };
      
      return { data: { items: data } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Exams create handler
  private async handleExamsCreate(request: APIRequest): Promise<APIResponse> {
    try {
      const {
        title,
        description = null,
        start_time,
        end_time,
        duration_minutes,
        status = "draft",
        access_type = "open",
        settings = {},
      } = request.body || {};

      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);

      const { data, error } = await svc
        .from("exams")
        .insert({ title, description, start_time, end_time, duration_minutes, status, access_type, settings })
        .select("*")
        .single();
        
      if (error) return { error: error.message, status: 400 };
      
      return { data: { item: data } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Students list handler
  private async handleStudentsList(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      // Get students with their exam attempt statistics
      const { data, error } = await svc
        .from("student_exam_summary")
        .select("*")
        .order("student_created_at", { ascending: false });

      if (error) {
        return { error: error.message, status: 400 };
      }

      return { data: { students: data } };
    } catch (error: any) {
      return { error: error.message, status: 500 };
    }
  }

  // Students create handler
  private async handleStudentsCreate(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      const { student_name, mobile_number, code } = request.body;
      
      // Generate code if not provided
      let finalCode = code;
      if (!finalCode) {
        // Import code generation utilities
        const { getCodeFormatSettings, generateRandomCode } = await import("@/lib/codeGenerator");
        
        // Get current code format settings and generate a unique code
        const codeSettings = await getCodeFormatSettings();
        let attempts = 0;
        do {
          finalCode = generateRandomCode(codeSettings);
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
        return { error: "Code already exists", status: 400 };
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
        return { error: error.message, status: 400 };
      }

      return { data: { student: data } };
    } catch (error: any) {
      return { error: error.message, status: 500 };
    }
  }

  // Settings get handler
  private async handleSettingsGet(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(process.env.SUPABASE_SERVICE_ROLE_KEY ? undefined : (token || undefined));
      
      // Try single-row table approach
      const { data, error } = await svc.from("app_settings").select("*").limit(1).maybeSingle();
      if (error?.code === "42P01" /* undefined_table */) {
        return { error: "not_configured", status: 501 };
      }
      if (error) return { error: error.message, status: 400 };
      
      return { data: { item: data || null } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Settings update handler
  private async handleSettingsUpdate(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(process.env.SUPABASE_SERVICE_ROLE_KEY ? undefined : (token || undefined));
      const payload = request.body;

      // If table missing, indicate to configure DB
      const { data: existing, error: selErr } = await svc.from("app_settings").select("id").limit(1).maybeSingle();
      if (selErr?.code === "42P01") {
        return { error: "not_configured", status: 501 };
      }
      if (selErr) return { error: selErr.message, status: 400 };

      if (!existing) {
        const { data, error } = await svc.from("app_settings").insert([{ ...payload }]).select("*").single();
        if (error) return { error: error.message, status: 400 };
        return { data: { item: data } };
      } else {
        const { data, error } = await svc.from("app_settings").update({ ...payload }).eq("id", existing.id).select("*").single();
        if (error) return { error: error.message, status: 400 };
        return { data: { item: data } };
      }
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Monitoring handler
  private async handleMonitoring(request: APIRequest): Promise<APIResponse> {
    try {
      const svc = supabaseServer();

      const now = new Date();
      const iso60m = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const iso2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

      // Active attempts (started but not submitted, last 2h window)
      const activeQ = await svc
        .from("exam_attempts")
        .select("id, exam_id, ip_address, started_at, students(student_name, code)")
        .is("submitted_at", null)
        .gte("started_at", iso2h)
        .order("started_at", { ascending: false })
        .limit(200);

      if (activeQ.error?.code === "42P01") {
        return { error: "not_configured", status: 501 };
      }
      if (activeQ.error) return { error: activeQ.error.message, status: 400 };
      const active = (activeQ.data ?? []) as any[];

      // Recent submissions (last 60 minutes)
      const recentQ = await svc
        .from("exam_attempts")
        .select("id, exam_id, ip_address, started_at, submitted_at, completion_status, students(student_name, code)")
        .not("submitted_at", "is", null)
        .gte("submitted_at", iso60m)
        .order("submitted_at", { ascending: false })
        .limit(50);

      if (recentQ.error) return { error: recentQ.error.message, status: 400 };
      const recent = (recentQ.data ?? []) as any[];

      // Collect exam IDs and fetch titles
      const examIds = Array.from(new Set([...active.map(a => a.exam_id), ...recent.map(r => r.exam_id)].filter(Boolean)));
      let examMap: Record<string, any> = {};
      if (examIds.length) {
        const ex = await svc.from("exams").select("id, title").in("id", examIds);
        if (ex.error) return { error: ex.error.message, status: 400 };
        examMap = Object.fromEntries((ex.data ?? []).map((e: any) => [e.id, e]));
      }

      const active_count = active.length;
      const submissions_last_60m = recent.length;

      // Per-exam active counts
      const running_by_exam_map: Record<string, number> = {};
      for (const a of active) {
        if (!a.exam_id) continue;
        running_by_exam_map[a.exam_id] = (running_by_exam_map[a.exam_id] || 0) + 1;
      }
      const running_by_exam = Object.entries(running_by_exam_map).map(([exam_id, count]) => ({
        exam_id,
        exam_title: examMap[exam_id]?.title ?? "Unknown",
        count,
      })).sort((a, b) => b.count - a.count);

      // Decorate lists with titles
      const active_list = active.map((a) => ({
        id: a.id,
        exam_id: a.exam_id,
        exam_title: examMap[a.exam_id]?.title ?? "Unknown",
        student_name: (a as any)?.students?.student_name ?? (a as any)?.student_name ?? null,
        ip_address: a.ip_address ?? null,
        started_at: a.started_at,
      }));

      const recent_list = recent.map((r) => ({
        id: r.id,
        exam_id: r.exam_id,
        exam_title: examMap[r.exam_id]?.title ?? "Unknown",
        student_name: (r as any)?.students?.student_name ?? (r as any)?.student_name ?? null,
        ip_address: r.ip_address ?? null,
        started_at: r.started_at,
        submitted_at: r.submitted_at,
        completion_status: r.completion_status,
      }));

      return {
        data: {
          now: now.toISOString(),
          active_count,
          submissions_last_60m,
          running_by_exam,
          active_list,
          recent_list,
        }
      };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Whoami handler
  private async handleWhoami(request: APIRequest): Promise<APIResponse> {
    try {
      // User info is already available from admin context
      const user = AdminTokenHandler.getAdminUser(request);
      return { data: { ok: true, user } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Audit logs handler
  private async handleAuditLogs(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      const { data, error } = await svc
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        return { error: error.message, status: 400 };
      }

      return { data: { logs: data } };
    } catch (error: any) {
      return { error: error.message, status: 500 };
    }
  }

  // Exam detail handler
  private async handleExamDetail(request: APIRequest): Promise<APIResponse> {
    try {
      const examId = this.extractParamFromPath(request.path, 'examId');
      if (!examId) {
        return { error: "Exam ID is required", status: 400 };
      }

      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      const { data, error } = await svc.from("exams").select("*").eq("id", examId).single();
      if (error) return { error: error.message, status: 404 };
      
      return { data: { item: data } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Exam update handler
  private async handleExamUpdate(request: APIRequest): Promise<APIResponse> {
    try {
      const examId = this.extractParamFromPath(request.path, 'examId');
      if (!examId) {
        return { error: "Exam ID is required", status: 400 };
      }

      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);

      const { data, error } = await svc
        .from("exams")
        .update(request.body)
        .eq("id", examId)
        .select("*")
        .single();
        
      if (error) return { error: error.message, status: 400 };
      
      return { data: { item: data } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Exam delete handler
  private async handleExamDelete(request: APIRequest): Promise<APIResponse> {
    try {
      const examId = this.extractParamFromPath(request.path, 'examId');
      if (!examId) {
        return { error: "Exam ID is required", status: 400 };
      }

      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      const { error } = await svc.from("exams").delete().eq("id", examId);
      if (error) return { error: error.message, status: 400 };
      
      return { data: { ok: true } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Student detail handler
  private async handleStudentDetail(request: APIRequest): Promise<APIResponse> {
    try {
      const studentId = this.extractParamFromPath(request.path, 'studentId');
      if (!studentId) {
        return { error: "Student ID is required", status: 400 };
      }

      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      const { data, error } = await svc.from("students").select("*").eq("id", studentId).single();
      if (error) return { error: error.message, status: 404 };
      
      return { data: { item: data } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Student update handler
  private async handleStudentUpdate(request: APIRequest): Promise<APIResponse> {
    try {
      const studentId = this.extractParamFromPath(request.path, 'studentId');
      if (!studentId) {
        return { error: "Student ID is required", status: 400 };
      }

      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);

      const { data, error } = await svc
        .from("students")
        .update(request.body)
        .eq("id", studentId)
        .select("*")
        .single();
        
      if (error) return { error: error.message, status: 400 };
      
      return { data: { item: data } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Student delete handler
  private async handleStudentDelete(request: APIRequest): Promise<APIResponse> {
    try {
      const studentId = this.extractParamFromPath(request.path, 'studentId');
      if (!studentId) {
        return { error: "Student ID is required", status: 400 };
      }

      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      const { error } = await svc.from("students").delete().eq("id", studentId);
      if (error) return { error: error.message, status: 400 };
      
      return { data: { ok: true } };
    } catch (error: any) {
      return { error: error?.message || "unexpected_error", status: 500 };
    }
  }

  // Students bulk create handler
  private async handleStudentsBulkCreate(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      const { students } = request.body;
      
      if (!Array.isArray(students) || students.length === 0) {
        return { error: "No students provided", status: 400 };
      }
      
      // Get existing codes to avoid duplicates
      const { data: existingCodes } = await svc
        .from("students")
        .select("code");
      
      const existingCodeSet = new Set(existingCodes?.map(c => c.code) || []);
      
      const toInsert = [];
      const errors = [];
      
      // Get current code format settings for bulk import
      const { getCodeFormatSettings, generateRandomCode } = await import("@/lib/codeGenerator");
      const codeSettings = await getCodeFormatSettings();
      
      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        const { student_name, mobile_number, code } = student;
        
        if (!mobile_number) {
          errors.push(`Row ${i + 1}: Mobile number is required`);
          continue;
        }
        
        let finalCode = code;
        if (!finalCode) {
          // Generate a unique code using current format settings
          let attempts = 0;
          do {
            finalCode = generateRandomCode(codeSettings);
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
        return { 
          error: "Import errors occurred", 
          data: { details: errors },
          status: 400 
        };
      }
      
      if (toInsert.length === 0) {
        return { 
          error: "No valid students to import",
          status: 400 
        };
      }
      
      const { data, error } = await svc
        .from("students")
        .insert(toInsert)
        .select("*");

      if (error) {
        return { error: error.message, status: 400 };
      }

      return { 
        data: {
          students: data,
          created_count: data?.length || 0
        }
      };
    } catch (error: any) {
      return { error: error.message, status: 500 };
    }
  }

  // Students WhatsApp handler
  private async handleStudentsWhatsApp(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      const { studentIds, message } = request.body;
      
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return { error: "No students selected", status: 400 };
      }
      
      if (!message || typeof message !== 'string') {
        return { error: "Message is required", status: 400 };
      }
      
      // Get students with mobile numbers
      const { data: students, error: studentsError } = await svc
        .from("students")
        .select("id, code, student_name, mobile_number")
        .in("id", studentIds)
        .not("mobile_number", "is", null);
      
      if (studentsError) {
        return { error: studentsError.message, status: 400 };
      }
      
      if (!students || students.length === 0) {
        return { error: "No students found with mobile numbers", status: 400 };
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
      
      return { 
        data: {
          success: true,
          results,
          message: `WhatsApp URLs generated for ${results.length} students`
        }
      };
      
    } catch (error: any) {
      return { error: error.message, status: 500 };
    }
  }

  // System mode handler
  private async handleSystemMode(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      const { mode, message } = request.body;
      
      if (!['exam', 'results', 'disabled'].includes(mode)) {
        return { error: "Invalid mode. Must be 'exam', 'results', or 'disabled'", status: 400 };
      }
      
      // Update system mode in app_config
      const updates = [
        { key: 'system_mode', value: mode },
        { key: 'system_disabled', value: mode === 'disabled' ? 'true' : 'false' }
      ];
      
      if (message) {
        updates.push({ key: 'system_disabled_message', value: message });
      }
      
      for (const update of updates) {
        await svc.from("app_config")
          .upsert(update, { onConflict: 'key' });
      }
      
      return { data: { success: true, mode, message } };
    } catch (error: any) {
      return { error: error.message, status: 500 };
    }
  }

  // Cleanup expired handler
  private async handleCleanupExpired(request: APIRequest): Promise<APIResponse> {
    try {
      const token = AdminTokenHandler.getBearerToken(request);
      const svc = supabaseServer(token || undefined);
      
      // Clean up expired exam attempts (older than 24 hours and not submitted)
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await svc
        .from("exam_attempts")
        .delete()
        .is("submitted_at", null)
        .lt("started_at", cutoffTime);
      
      if (error) {
        return { error: error.message, status: 400 };
      }
      
      return { 
        data: { 
          success: true, 
          message: "Expired attempts cleaned up successfully" 
        } 
      };
    } catch (error: any) {
      return { error: error.message, status: 500 };
    }
  }

  // Helper method to extract parameters from path
  private extractParamFromPath(path: string[], paramName: string): string | null {
    // Find the segment that contains the parameter (e.g., [examId])
    const paramPattern = `[${paramName}]`;
    const paramIndex = path.findIndex(segment => segment.includes(paramPattern) || segment.match(/^[a-f0-9-]{36}$/));
    
    if (paramIndex === -1) {
      // Try to find UUID-like segments
      const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      const uuidIndex = path.findIndex(segment => uuidPattern.test(segment));
      return uuidIndex !== -1 ? path[uuidIndex] : null;
    }
    
    return path[paramIndex];
  }
}

// Create handler instance
const adminHandler = new AdminAPIHandler();

// Export HTTP method handlers
export async function GET(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return adminHandler.handle(req, context);
}

export async function POST(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return adminHandler.handle(req, context);
}

export async function PUT(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return adminHandler.handle(req, context);
}

export async function PATCH(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return adminHandler.handle(req, context);
}

export async function DELETE(req: NextRequest, context?: { params?: Promise<Record<string, string>> }) {
  return adminHandler.handle(req, context);
}