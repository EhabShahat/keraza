"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";
import type { CodeFormatSettings } from "@/lib/codeGenerator";

interface ByCodeExamItem {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  access_type: "open" | "code_based" | "ip_restricted";
  is_active: boolean;
  not_started: boolean;
  ended: boolean;
  attempt_status: "in_progress" | "completed" | null;
  attempt_id: string | null;
}

export default function MultiExamEntry() {
  const { locale, dir } = useStudentLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exams, setExams] = useState<ByCodeExamItem[] | null>(null);
  const [startingExamId, setStartingExamId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [codeSettings, setCodeSettings] = useState<CodeFormatSettings | null>(null);
  const [isMultiExamMode, setIsMultiExamMode] = useState<boolean>(true);

  // Track current ?code value from URL
  const codeParam = useMemo(() => (searchParams?.get("code") || "").trim(), [searchParams]);

  // Fetch code format settings on mount
  useEffect(() => {
    async function fetchCodeSettings() {
      try {
        const res = await fetch("/api/public/code-settings", { cache: "no-store" });
        if (res.ok) {
          const settings = await res.json();
          setCodeSettings(settings);
          setIsMultiExamMode(settings.enable_multi_exam ?? true);
        }
      } catch (error) {
        console.warn("Failed to fetch code settings, using defaults");
        setCodeSettings({
          code_length: 4,
          code_format: "numeric",
          code_pattern: null,
          enable_multi_exam: true,
        });
        setIsMultiExamMode(true);
      }
    }
    void fetchCodeSettings();
  }, []);

  // Helper function to validate code format
  const isValidCode = (code: string): boolean => {
    if (!codeSettings || !code) return false;
    
    const { code_length, code_format, code_pattern } = codeSettings;

    if (code_format === "custom" && code_pattern) {
      if (code.length !== code_pattern.length) return false;
      
      for (let i = 0; i < code_pattern.length; i++) {
        const patternChar = code_pattern[i];
        const codeChar = code[i];

        switch (patternChar) {
          case "N":
            if (!/\d/.test(codeChar)) return false;
            break;
          case "A":
            if (!/[A-Z]/i.test(codeChar)) return false;
            break;
          case "#":
            if (!/[A-Z0-9]/i.test(codeChar)) return false;
            break;
          default:
            if (codeChar !== patternChar) return false;
        }
      }
      return true;
    }

    if (code.length !== code_length) return false;

    switch (code_format) {
      case "numeric":
        return /^\d+$/.test(code);
      case "alphabetic":
        return /^[A-Z]+$/i.test(code);
      case "alphanumeric":
        return /^[A-Z0-9]+$/i.test(code);
      default:
        return /^\d+$/.test(code);
    }
  };

  // Helper functions for input field
  const getPlaceholder = (): string => {
    if (!codeSettings) return "0000";
    
    const { code_length, code_format, code_pattern } = codeSettings;
    
    if (code_format === "custom" && code_pattern) {
      return code_pattern.replace(/N/g, "0").replace(/A/g, "A").replace(/#/g, "0");
    }
    
    switch (code_format) {
      case "numeric":
        return "0".repeat(code_length);
      case "alphabetic":
        return "A".repeat(code_length);
      case "alphanumeric":
        return "A0".repeat(Math.ceil(code_length / 2)).substring(0, code_length);
      default:
        return "0".repeat(code_length);
    }
  };

  const getMaxLength = (): number => {
    if (!codeSettings) return 4;
    
    const { code_length, code_format, code_pattern } = codeSettings;
    
    if (code_format === "custom" && code_pattern) {
      return code_pattern.length;
    }
    
    return code_length;
  };

  // Prefill/refetch based on ?code param; rerun on param changes (including return navigation)
  useEffect(() => {
    if (codeSettings && isValidCode(codeParam)) {
      setCode(codeParam);
      void verifyCode(codeParam);
    }
  }, [codeParam, codeSettings]);


  // Also refetch when the page regains focus or becomes visible (handles browser back/BFCache cases)
  useEffect(() => {
    function refetchIfCode() {
      if (codeSettings && isValidCode(codeParam)) {
        void verifyCode(codeParam);
      }
    }
    const onFocus = () => refetchIfCode();
    const onVisibility = () => {
      try {
        if (document.visibilityState === "visible") refetchIfCode();
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [codeParam]);

  const hasResults = useMemo(() => (exams?.length || 0) > 0, [exams]);

  async function verifyCode(nextCode?: string) {
    const c = (nextCode ?? code).trim();
    if (!isValidCode(c)) {
      setError(t(locale, "code_must_be_4_digits"));
      return;
    }
    setChecking(true);
    setError(null);
    setExams(null);
    try {
      const res = await fetch(`/api/public/exams/by-code?code=${encodeURIComponent(c)}`, { cache: "no-store" });
      if (!res.ok) {
        setError(t(locale, "code_not_found"));
        return;
      }
      const data = await res.json();
      const items: ByCodeExamItem[] = data?.exams || [];
      setStudentName(data?.student_name || null);
      
      // In single exam mode, if there's exactly one exam, go directly to it
      if (!isMultiExamMode && items.length === 1) {
        const exam = items[0];
        if (exam.is_active && !exam.not_started && !exam.ended && exam.attempt_status !== "completed") {
          await startOrContinueExam(exam.id);
          return;
        }
      }
      
      setExams(items);
    } catch {
      setError(t(locale, "error_loading_results"));
    } finally {
      setChecking(false);
    }
  }

  async function startOrContinueExam(examId: string) {
    const c = code.trim();
    if (!isValidCode(c)) return;

    setStartingExamId(examId);
    setError(null);
    try {
      const res = await fetch(`/api/public/exams/${examId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, studentName: null }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errKey = data?.error || "failed";
        switch (errKey) {
          case "code_required":
            setError(t(locale, "err_code_required"));
            break;
          case "invalid_code":
            setError(t(locale, "err_invalid_code"));
            break;
          case "code_already_used":
            setError(t(locale, "err_code_already_used"));
            break;
          case "exam_not_published":
            setError(t(locale, "err_exam_not_published"));
            break;
          case "exam_not_started":
            setError(t(locale, "err_exam_not_started"));
            break;
          case "exam_ended":
            setError(t(locale, "err_exam_ended"));
            break;
          case "attempt_limit_reached":
            setError(t(locale, "err_attempt_limit_reached"));
            break;
          case "ip_not_whitelisted":
            setError(t(locale, "err_ip_not_whitelisted"));
            break;
          case "ip_blacklisted":
            setError(t(locale, "err_ip_blacklisted"));
            break;
          default:
            setError(t(locale, "unable_load_exam"));
        }
        return;
      }

      const attemptId: string = data.attemptId;
      const studentNameFromResponse: string = data.studentName || "Student";
      const welcomeUrl = `/welcome/${attemptId}?name=${encodeURIComponent(studentNameFromResponse)}`;
      try {
        router.push(welcomeUrl);
      } catch {
        window.location.href = welcomeUrl;
      }
    } catch {
      setError(t(locale, "unable_load_exam"));
    } finally {
      setStartingExamId(null);
    }
  }

  function formatDateInCairo(iso: string | null) {
    if (!iso) return "";
    try {
      const dt = new Date(iso);
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(dt);
    } catch {
      try { return new Date(iso!).toLocaleString(locale); } catch { return iso!; }
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir={dir} lang={locale}>
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg backdrop-blur-sm">
          {/* Brand Logo */}
          <div className="mb-8">
            <BrandLogo useAppSettings={true} size="lg" />
          </div>

          {/* Code entry section */}
          {exams === null && (
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t(locale, "select_exam")}</h2>
                <p className="text-gray-600 text-sm">{t(locale, "results_search_hint_code")}</p>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); void verifyCode(); }}
                className="space-y-4"
              >
                <label htmlFor="exam-code" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t(locale, "exam_code")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder={codeSettings ? getPlaceholder() : "0000"}
                    maxLength={codeSettings ? getMaxLength() : 4}
                    inputMode={codeSettings?.code_format === "numeric" ? "numeric" : "text"}
                    autoComplete="one-time-code"
                    required
                  />
                  <div className={`absolute inset-y-0 ${dir === "rtl" ? "left-4" : "right-4"} flex items-center pointer-events-none`}>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2h-6m6 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2h6z" />
                    </svg>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-red-800 text-sm" role="alert">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={checking || !isValidCode(code)}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-md"
                >
                  {checking ? (
                    <span className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t(locale, "checking_code")}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      {t(locale, "find_exams")}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: dir === "rtl" ? "scaleX(-1)" : undefined }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Exams list */}
          {exams !== null && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{studentName ? t(locale, "exams_available_for_student", { name: studentName }) : t(locale, "exams_available_for_code", { code })}</h2>
                  {!hasResults && (
                    <p className="text-gray-600 text-sm mt-1">{t(locale, "no_exams_for_code")}</p>
                  )}
                </div>
                <button
                  className="btn btn-outline"
                  onClick={() => { setExams(null); setError(null); setStudentName(null); }}
                >
                  {t(locale, "change_code")}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {exams?.map((ex) => {
                  const isCompleted = ex.attempt_status === "completed";
                  const isDisabled = ex.ended || ex.not_started || isCompleted;
                  const actionLabel = ex.attempt_status === "in_progress" ? t(locale, "continue_to_exam") : t(locale, "start_exam");
                  return (
                    <div key={ex.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            <span className="inline-flex items-center gap-2">
                              {isCompleted && (
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              {ex.title}
                            </span>
                          </h3>
                          {ex.description && (
                            <p className="text-gray-600 text-sm mt-1">{ex.description}</p>
                          )}
                          {/* Intentionally removed duration and availability lines for cleaner UI */}
                        </div>
                        <div className="flex items-center gap-3">
                          {ex.not_started && (
                            <span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-800 border border-amber-200">{t(locale, "exam_not_started")}</span>
                          )}
                          {ex.ended && (
                            <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800 border border-red-200">{t(locale, "exam_ended")}</span>
                          )}
                          {isCompleted && (
                            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 border border-gray-200">{t(locale, "completed")}</span>
                          )}
                          <button
                            disabled={isDisabled || startingExamId === ex.id}
                            onClick={() => startOrContinueExam(ex.id)}
                            className="btn btn-primary"
                          >
                            {startingExamId === ex.id ? (
                              <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                {t(locale, "starting_exam")}
                              </span>
                            ) : (
                              isCompleted ? t(locale, "completed") : actionLabel
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
