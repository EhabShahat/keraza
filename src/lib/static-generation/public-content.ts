/**
 * Static Generation Utilities for Public Content
 * Handles static generation and incremental static regeneration for public content
 */

import { supabaseServer } from "@/lib/supabase/server";
import { getCodeFormatSettings } from "@/lib/codeGenerator";

/**
 * Static generation configuration
 */
export const STATIC_GENERATION_CONFIG = {
  systemMode: {
    revalidate: 300, // 5 minutes
    tags: ['system-mode', 'config']
  },
  appSettings: {
    revalidate: 1800, // 30 minutes
    tags: ['app-settings', 'config']
  },
  codeSettings: {
    revalidate: 900, // 15 minutes
    tags: ['code-settings', 'config']
  },
  examInfo: {
    revalidate: 900, // 15 minutes
    tags: ['exam-info', 'exam']
  },
  activeExams: {
    revalidate: 60, // 1 minute
    tags: ['active-exams', 'exam']
  }
} as const;

/**
 * System mode data for static generation
 */
export async function generateSystemModeData(): Promise<{
  mode: "exam" | "results" | "disabled";
  message: string | null;
  error?: string;
}> {
  try {
    const svc = supabaseServer();

    const { data, error } = await svc
      .from("app_config")
      .select("key, value")
      .in("key", ["system_mode", "system_disabled", "system_disabled_message"]);

    if (error) {
      return { 
        mode: "exam", 
        message: null, 
        error: error.message 
      };
    }

    const map = new Map<string, string>();
    for (const row of data || []) {
      map.set((row as any).key, (row as any).value);
    }

    const legacyDisabled = map.get("system_disabled") === "true";
    const mode = (map.get("system_mode") as "exam" | "results" | "disabled" | undefined) || 
                 (legacyDisabled ? "disabled" : "exam");
    const message = map.get("system_disabled_message") || 
                   "No exams are currently available. Please check back later.";

    return { mode, message };
  } catch (e: any) {
    return { 
      mode: "exam", 
      message: null, 
      error: e?.message || "unexpected_error" 
    };
  }
}

/**
 * App settings data for static generation
 */
export async function generateAppSettingsData(): Promise<Record<string, any>> {
  try {
    const svc = supabaseServer();
    
    // Try to select all columns first, then fall back to basic columns
    let { data, error } = await svc
      .from("app_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    // If there's a column error, try with just basic columns
    if (error && error.code === "42703") {
      const result = await svc
        .from("app_settings")
        .select([
          "brand_name",
          "brand_logo_url", 
          "default_language",
          "welcome_instructions",
          "welcome_instructions_ar",
          "thank_you_title",
          "thank_you_title_ar",
          "thank_you_message",
          "thank_you_message_ar",
          "enable_name_search",
          "enable_code_search"
        ].join(", "))
        .limit(1)
        .maybeSingle();
      
      data = result.data;
      error = result.error;

      // If still missing columns, try minimal safe subset
      if (error && error.code === "42703") {
        const result2 = await svc
          .from("app_settings")
          .select(["brand_name", "brand_logo_url"].join(", "))
          .limit(1)
          .maybeSingle();
        data = result2.data;
        error = result2.error;
      }
    }

    if (error) {
      console.error("Error generating app settings:", error);
      
      // If table doesn't exist, return empty object
      if (error.code === "42P01") {
        return {};
      }
      
      throw new Error(error.message);
    }

    return data || {};
  } catch (e: any) {
    console.error("Error in generateAppSettingsData:", e);
    return {};
  }
}

/**
 * Code settings data for static generation
 */
export async function generateCodeSettingsData(): Promise<{
  code_length: number;
  code_format: "numeric" | "alphanumeric" | "alphabetic";
  code_pattern: string | null;
}> {
  try {
    const settings = await getCodeFormatSettings();
    return settings;
  } catch (error) {
    console.error("Error generating code settings:", error);
    return {
      code_length: 4,
      code_format: "numeric",
      code_pattern: null
    };
  }
}

/**
 * Active exams data for static generation
 */
export async function generateActiveExamsData(): Promise<{
  exams?: any[];
  error?: string;
  code?: string;
  details?: string;
}> {
  try {
    const svc = supabaseServer();

    // Get system mode first
    const systemMode = await generateSystemModeData();
    
    if (systemMode.mode === "disabled") {
      return {
        error: "System is currently disabled",
        code: "system_disabled",
        details: systemMode.message || "No exams are currently available"
      };
    }

    if (systemMode.mode === "results") {
      return {
        error: "System is in results-only mode",
        code: "results_only",
        details: "Only results viewing is available at this time"
      };
    }

    // Fetch active exams
    const { data: exams, error } = await svc
      .from("exams")
      .select("id, title, description, settings, created_at, updated_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching active exams:", error);
      return {
        error: "Failed to fetch exams",
        code: "fetch_error",
        details: error.message
      };
    }

    return { exams: exams || [] };
  } catch (e: any) {
    console.error("Error in generateActiveExamsData:", e);
    return {
      error: "Unexpected error",
      code: "unexpected_error",
      details: e?.message || "An unexpected error occurred"
    };
  }
}

/**
 * Exam information data for static generation
 */
export async function generateExamInfoData(examId: string): Promise<{
  exam?: any;
  error?: string;
}> {
  try {
    const svc = supabaseServer();

    const { data: exam, error } = await svc
      .from("exams")
      .select("id, title, description, settings, is_published, created_at, updated_at")
      .eq("id", examId)
      .eq("is_published", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { error: "Exam not found" };
      }
      console.error("Error fetching exam info:", error);
      return { error: "Failed to fetch exam information" };
    }

    if (!exam) {
      return { error: "Exam not found" };
    }

    // Remove sensitive information for public consumption
    const publicExam = {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      settings: {
        // Only include public settings
        time_limit: exam.settings?.time_limit,
        show_results: exam.settings?.show_results,
        allow_review: exam.settings?.allow_review,
        instructions: exam.settings?.instructions,
        instructions_ar: exam.settings?.instructions_ar
      },
      created_at: exam.created_at,
      updated_at: exam.updated_at
    };

    return { exam: publicExam };
  } catch (e: any) {
    console.error("Error in generateExamInfoData:", e);
    return { error: e?.message || "unexpected_error" };
  }
}

/**
 * Generate all static public content
 */
export async function generateAllPublicContent(): Promise<{
  systemMode: Awaited<ReturnType<typeof generateSystemModeData>>;
  appSettings: Awaited<ReturnType<typeof generateAppSettingsData>>;
  codeSettings: Awaited<ReturnType<typeof generateCodeSettingsData>>;
  activeExams: Awaited<ReturnType<typeof generateActiveExamsData>>;
}> {
  const [systemMode, appSettings, codeSettings, activeExams] = await Promise.all([
    generateSystemModeData(),
    generateAppSettingsData(),
    generateCodeSettingsData(),
    generateActiveExamsData()
  ]);

  return {
    systemMode,
    appSettings,
    codeSettings,
    activeExams
  };
}

/**
 * Cache tags for invalidation
 */
export function getContentCacheTags(contentType: keyof typeof STATIC_GENERATION_CONFIG): string[] {
  return STATIC_GENERATION_CONFIG[contentType].tags;
}

/**
 * Revalidation time for content type
 */
export function getContentRevalidateTime(contentType: keyof typeof STATIC_GENERATION_CONFIG): number {
  return STATIC_GENERATION_CONFIG[contentType].revalidate;
}