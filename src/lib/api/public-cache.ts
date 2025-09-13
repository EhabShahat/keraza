import { supabaseServer } from "@/lib/supabase/server";

/**
 * Cache configuration for different types of public data
 */
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  tags: string[]; // Cache tags for invalidation
  key: string; // Cache key
}

/**
 * In-memory cache for public API endpoints
 * This provides fast access to frequently requested data
 */
class PublicAPICache {
  private cache = new Map<string, { data: any; expires: number; tags: string[] }>();
  private readonly maxSize = 1000; // Maximum cache entries
  
  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number, tags: string[] = []): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttl * 1000),
      tags
    });
  }
  
  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      hits: this.hitCount,
      misses: this.missCount
    };
  }
  
  private hitCount = 0;
  private missCount = 0;
  
  /**
   * Record cache hit
   */
  private recordHit(): void {
    this.hitCount++;
  }
  
  /**
   * Record cache miss
   */
  private recordMiss(): void {
    this.missCount++;
  }
}

// Global cache instance
const publicCache = new PublicAPICache();

/**
 * Cache configurations for different public endpoints
 */
export const CACHE_CONFIGS = {
  SYSTEM_MODE: {
    ttl: 300, // 5 minutes
    tags: ['system', 'config'],
    key: 'system-mode'
  },
  APP_SETTINGS: {
    ttl: 600, // 10 minutes
    tags: ['settings', 'config'],
    key: 'app-settings'
  },
  CODE_SETTINGS: {
    ttl: 3600, // 1 hour
    tags: ['code', 'settings'],
    key: 'code-settings'
  },
  ACTIVE_EXAMS: {
    ttl: 60, // 1 minute (frequently changing)
    tags: ['exams', 'active'],
    key: 'active-exams'
  },
  EXAM_INFO: (examId: string) => ({
    ttl: 1800, // 30 minutes
    tags: ['exam', `exam-${examId}`],
    key: `exam-info-${examId}`
  }),
  STUDENT_EXAMS: (code: string) => ({
    ttl: 300, // 5 minutes
    tags: ['student', 'exams', `student-${code}`],
    key: `student-exams-${code}`
  })
} as const;

/**
 * Cached wrapper for system mode data
 */
export async function getCachedSystemMode(): Promise<any> {
  const config = CACHE_CONFIGS.SYSTEM_MODE;
  const cached = publicCache.get(config.key);
  
  if (cached) {
    publicCache['recordHit']();
    return cached;
  }
  
  publicCache['recordMiss']();
  
  try {
    const svc = supabaseServer();
    const { data, error } = await svc
      .from("app_config")
      .select("key, value")
      .in("key", ["system_mode", "system_disabled", "system_disabled_message"]);

    let result;
    if (error) {
      result = { mode: "exam", message: null, error: error.message };
    } else {
      const map = new Map<string, string>();
      for (const row of data || []) {
        map.set((row as any).key, (row as any).value);
      }

      const legacyDisabled = map.get("system_disabled") === "true";
      const mode = (map.get("system_mode") as "exam" | "results" | "disabled" | undefined) || (legacyDisabled ? "disabled" : "exam");
      const message = map.get("system_disabled_message") || "No exams are currently available. Please check back later.";

      result = { mode, message };
    }
    
    publicCache.set(config.key, result, config.ttl, config.tags);
    return result;
  } catch (e: any) {
    const fallback = { mode: "exam", message: null, error: e?.message || "unexpected_error" };
    publicCache.set(config.key, fallback, 60, config.tags); // Short cache for errors
    return fallback;
  }
}

/**
 * Cached wrapper for app settings
 */
export async function getCachedAppSettings(): Promise<any> {
  const config = CACHE_CONFIGS.APP_SETTINGS;
  const cached = publicCache.get(config.key);
  
  if (cached) {
    publicCache['recordHit']();
    return cached;
  }
  
  publicCache['recordMiss']();
  
  try {
    const svc = supabaseServer();
    
    // Try to fetch app settings with fallback strategy
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
          "enable_code_search",
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

    let result;
    if (error) {
      if (error.code === "42P01") {
        result = {}; // Table doesn't exist
      } else {
        throw error;
      }
    } else {
      result = data || {};
    }
    
    publicCache.set(config.key, result, config.ttl, config.tags);
    return result;
  } catch (e: any) {
    const fallback = {};
    publicCache.set(config.key, fallback, 60, config.tags); // Short cache for errors
    return fallback;
  }
}

/**
 * Cached wrapper for code settings
 */
export async function getCachedCodeSettings(): Promise<any> {
  const config = CACHE_CONFIGS.CODE_SETTINGS;
  const cached = publicCache.get(config.key);
  
  if (cached) {
    publicCache['recordHit']();
    return cached;
  }
  
  publicCache['recordMiss']();
  
  try {
    // Import here to avoid circular dependencies
    const { getCodeFormatSettings } = await import("@/lib/codeGenerator");
    const settings = await getCodeFormatSettings();
    
    publicCache.set(config.key, settings, config.ttl, config.tags);
    return settings;
  } catch (error) {
    const fallback = {
      code_length: 4,
      code_format: "numeric",
      code_pattern: null,
    };
    publicCache.set(config.key, fallback, 60, config.tags); // Short cache for errors
    return fallback;
  }
}

/**
 * Cached wrapper for active exams
 */
export async function getCachedActiveExams(): Promise<any> {
  const config = CACHE_CONFIGS.ACTIVE_EXAMS;
  const cached = publicCache.get(config.key);
  
  if (cached) {
    publicCache['recordHit']();
    return cached;
  }
  
  publicCache['recordMiss']();
  
  try {
    const svc = supabaseServer();
    
    const { data, error } = await svc
      .from("exams")
      .select("id, title, status, start_time, end_time, access_type, created_at")
      .eq("status", "published")
      .order("start_time", { ascending: true, nullsFirst: true });

    if (error) {
      throw error;
    }

    const now = new Date();
    const list = (data || []).map((e) => {
      const start = e.start_time ? new Date(e.start_time as any) : null;
      const end = e.end_time ? new Date(e.end_time as any) : null;
      const notStarted = !!(start && now < start);
      const ended = !!(end && now > end);
      const isActive = !notStarted && !ended;
      return {
        ...e,
        is_active: isActive,
        not_started: notStarted,
        ended,
      };
    });

    // Backward compatibility: keep a single activeExam field
    const firstActive = list.find((e) => e.is_active) || list[0] || null;
    const activeExam = firstActive
      ? {
          id: firstActive.id,
          title: firstActive.title,
          status: firstActive.status,
          start_time: firstActive.start_time,
          end_time: firstActive.end_time,
          access_type: firstActive.access_type,
          created_at: (firstActive as any).created_at,
        }
      : null;

    const startTime = (firstActive?.start_time ? new Date(firstActive.start_time as any) : null) as Date | null;
    const endTime = (firstActive?.end_time ? new Date(firstActive.end_time as any) : null) as Date | null;
    const isNotStarted = !!(startTime && now < startTime);
    const isEnded = !!(endTime && now > endTime);
    const isActive = !!firstActive && !isNotStarted && !isEnded;

    const result = {
      activeExam,
      activeExams: list,
      isActive,
      timeCheck: activeExam
        ? {
            now: now.toISOString(),
            startTime: startTime ? startTime.toISOString() : null,
            endTime: endTime ? endTime.toISOString() : null,
            isNotStarted,
            isEnded,
          }
        : null,
    };
    
    publicCache.set(config.key, result, config.ttl, config.tags);
    return result;
  } catch (e: any) {
    const fallback = {
      activeExam: null,
      activeExams: [],
      isActive: false,
      timeCheck: null,
      error: e?.message || "unexpected_error"
    };
    publicCache.set(config.key, fallback, 60, config.tags); // Short cache for errors
    return fallback;
  }
}

/**
 * Cached wrapper for exam info
 */
export async function getCachedExamInfo(examId: string): Promise<any> {
  const config = CACHE_CONFIGS.EXAM_INFO(examId);
  const cached = publicCache.get(config.key);
  
  if (cached) {
    publicCache['recordHit']();
    return cached;
  }
  
  publicCache['recordMiss']();
  
  try {
    const svc = supabaseServer();
    
    const { data, error } = await svc
      .from("exams")
      .select("id, title, description, access_type, start_time, end_time, duration_minutes, status")
      .eq("id", examId)
      .eq("status", "published")
      .single();

    if (error || !data) {
      const notFound = { error: "Exam not found" };
      publicCache.set(config.key, notFound, 300, config.tags); // Cache not found for 5 minutes
      return notFound;
    }
    
    publicCache.set(config.key, data, config.ttl, config.tags);
    return data;
  } catch (e: any) {
    const fallback = { error: e?.message || "unexpected_error" };
    publicCache.set(config.key, fallback, 60, config.tags); // Short cache for errors
    return fallback;
  }
}

/**
 * Cached wrapper for student exams by code
 */
export async function getCachedStudentExams(code: string): Promise<any> {
  const config = CACHE_CONFIGS.STUDENT_EXAMS(code);
  const cached = publicCache.get(config.key);
  
  if (cached) {
    publicCache['recordHit']();
    return cached;
  }
  
  publicCache['recordMiss']();
  
  try {
    // Import here to avoid circular dependencies
    const { validateCodeFormat } = await import("@/lib/codeGenerator");
    const codeSettings = await getCachedCodeSettings();
    
    if (!validateCodeFormat(code, codeSettings)) {
      const invalid = { valid: false, reason: "format", exams: [] };
      publicCache.set(config.key, invalid, config.ttl, config.tags);
      return invalid;
    }

    const svc = supabaseServer();

    // 1) Find student by global code
    const { data: stuRows, error: stuErr } = await svc
      .from("students")
      .select("id, student_name")
      .eq("code", code)
      .limit(1);

    if (stuErr) {
      if (stuErr.code === "42P01" || stuErr.code === "42703") {
        const invalid = { valid: false, exams: [] };
        publicCache.set(config.key, invalid, config.ttl, config.tags);
        return invalid;
      }
      throw stuErr;
    }

    if (!stuRows || stuRows.length === 0) {
      const notFound = { valid: false, reason: "not_found", exams: [] };
      publicCache.set(config.key, notFound, config.ttl, config.tags);
      return notFound;
    }

    const studentId = (stuRows[0] as { id: string; student_name?: string | null }).id;
    const studentName = (stuRows[0] as { id: string; student_name?: string | null }).student_name || null;

    // 2) Fetch all published code-based exams
    const { data: exams, error: exErr } = await svc
      .from("exams")
      .select("id, title, description, duration_minutes, start_time, end_time, status, access_type")
      .eq("status", "published")
      .eq("access_type", "code_based")
      .order("created_at", { ascending: false });

    if (exErr) {
      throw exErr;
    }

    const examIds = (exams || []).map((e: any) => e.id);

    // Early return if no exams
    if (!examIds.length) {
      const result = { valid: true, student_id: studentId, student_name: studentName, exams: [] };
      publicCache.set(config.key, result, config.ttl, config.tags);
      return result;
    }

    // 3) Fetch student's attempts per exam (this part is not cached as it's user-specific and changes frequently)
    const { data: attempts, error: attErr } = await svc
      .from("student_exam_attempts")
      .select("exam_id, status, attempt_id")
      .eq("student_id", studentId)
      .in("exam_id", examIds);

    if (attErr) {
      console.error("by-code attempts error:", attErr);
      // Non-fatal - continue without attempt statuses
    }

    const attemptsMap = new Map<string, { status: string | null; attempt_id: string | null }>();
    for (const row of attempts || []) {
      attemptsMap.set((row as any).exam_id, {
        status: (row as any).status || null,
        attempt_id: (row as any).attempt_id || null,
      });
    }

    const now = new Date();
    const result = {
      valid: true,
      student_id: studentId,
      student_name: studentName,
      exams: (exams || []).map((e: any) => {
        const start = e.start_time ? new Date(e.start_time) : null;
        const end = e.end_time ? new Date(e.end_time) : null;
        const not_started = !!(start && now < start);
        const ended = !!(end && now > end);
        const is_active = !not_started && !ended;
        const at = attemptsMap.get(e.id) || { status: null, attempt_id: null };
        const attempt_status = (at.status as "in_progress" | "completed" | null) || null;
        const already_attempted = attempt_status === "in_progress" || attempt_status === "completed";
        return {
          id: e.id,
          title: e.title,
          description: e.description,
          duration_minutes: e.duration_minutes,
          start_time: e.start_time,
          end_time: e.end_time,
          status: e.status,
          access_type: e.access_type,
          is_active,
          not_started,
          ended,
          attempt_status,
          attempt_id: at.attempt_id,
          already_attempted,
        };
      })
    };
    
    // Cache for shorter time since attempt status can change
    publicCache.set(config.key, result, 60, config.tags); // 1 minute cache
    return result;
  } catch (e: any) {
    const fallback = { valid: false, exams: [], error: e?.message || "unexpected_error" };
    publicCache.set(config.key, fallback, 60, config.tags); // Short cache for errors
    return fallback;
  }
}

/**
 * Cache invalidation functions
 */
export const cacheInvalidation = {
  /**
   * Invalidate system configuration cache
   */
  invalidateSystemConfig(): void {
    publicCache.invalidateByTags(['system', 'config']);
  },
  
  /**
   * Invalidate app settings cache
   */
  invalidateAppSettings(): void {
    publicCache.invalidateByTags(['settings', 'config']);
  },
  
  /**
   * Invalidate exam-related cache
   */
  invalidateExams(examId?: string): void {
    if (examId) {
      publicCache.invalidateByTags([`exam-${examId}`]);
    } else {
      publicCache.invalidateByTags(['exams', 'active']);
    }
  },
  
  /**
   * Invalidate student-specific cache
   */
  invalidateStudent(code: string): void {
    publicCache.invalidateByTags([`student-${code}`]);
  },
  
  /**
   * Clear all cache
   */
  clearAll(): void {
    publicCache.clear();
  },
  
  /**
   * Get cache statistics
   */
  getStats() {
    return publicCache.getStats();
  }
};

export { publicCache };