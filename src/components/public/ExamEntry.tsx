"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

interface ExamInfo {
  id: string;
  title: string;
  description: string | null;
  access_type: "open" | "code_based" | "ip_restricted";
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
}

type AccessBody = {
  code: string | null;
  studentName: string | null;
};

export default function ExamEntry({
  examId,
  initialSystemMode,
  initialDisabledMessage,
  skipModeFetch = !!initialSystemMode,
}: {
  examId: string;
  initialSystemMode?: "exam" | "results" | "disabled";
  initialDisabledMessage?: string | null;
  skipModeFetch?: boolean;
}) {
  const router = useRouter();
  const { locale, dir } = useStudentLocale();
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null);
  const [systemMode, setSystemMode] = useState<"exam" | "results" | "disabled" | null>(initialSystemMode ?? null);
  const [disabledMessage, setDisabledMessage] = useState<string | null>(initialDisabledMessage ?? null);
  const [code, setCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingExam, setLoadingExam] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check tri-state system mode; redirect/guard when not in 'exam' mode
  useEffect(() => {
    if (!examId) return;
    if (skipModeFetch) return; // SSR provided mode; avoid client re-check to prevent mismatch/loops
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/system-mode", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setSystemMode(data.mode);
          setDisabledMessage(data.message || null);
          if (!skipModeFetch && data.mode === "results") {
            router.replace("/");
          }
          if (data.mode !== "exam") {
            setLoadingExam(false);
          }
        } else {
          setSystemMode("exam");
        }
      } catch {
        setSystemMode("exam");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, router, skipModeFetch]);

  // Fetch exam info
  useEffect(() => {
    if (!examId) return;
    if (systemMode && systemMode !== "exam") return;

    async function fetchData() {
      try {
        const examRes = await fetch(`/api/public/exams/${examId}/info`);
        if (!examRes.ok) {
          setError(t(locale, "unable_load_exam"));
          return;
        }
        const examData = (await examRes.json()) as ExamInfo;
        setExamInfo(examData);
      } catch {
        setError(t(locale, "unable_load_exam"));
      } finally {
        setLoadingExam(false);
      }
    }
    fetchData();
  }, [examId, systemMode, locale]);

  async function handleSubmit() {
    if (!examInfo) return;

    try {
      setLoading(true);
      setError(null);

      const requestBody: AccessBody =
        examInfo.access_type === "code_based"
          ? { code: code || null, studentName: null }
          : { code: null, studentName: studentName || null };

      const res = await fetch(`/api/public/exams/${examId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMessage = data?.error || "failed";
        switch (errorMessage) {
          case "code_required":
            setError(t(locale, "err_code_required"));
            break;
          case "student_name_required":
            setError(t(locale, "err_student_name_required"));
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
          case "access_denied":
            setError(data?.message || "Access has been restricted for this entry.");
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

      const attemptId = data.attemptId as string;
      const studentNameFromResponse = data.studentName || studentName || "Student";
      
      // Use window.location for better compatibility with old browsers
      const welcomeUrl = `/welcome/${attemptId}?name=${encodeURIComponent(studentNameFromResponse)}`;
      
      // Try modern router first, fallback to window.location
      try {
        router.push(welcomeUrl);
      } catch (error) {
        // Fallback for old browsers
        window.location.href = welcomeUrl;
      }
    } catch {
      setError(t(locale, "unable_load_exam"));
    } finally {
      setLoading(false);
    }
  }

  if (!examId || loadingExam) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center" dir={dir} lang={locale}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="space-y-2">
            <p className="text-gray-700 font-medium">{t(locale, "loading_exam")}</p>
            <p className="text-gray-500 text-sm">{t(locale, "loading_exam_hint")}</p>
          </div>
        </div>
      </main>
    );
  }

  if (systemMode === "results") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center" dir={dir} lang={locale}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-700 font-medium">{t(locale, "redirecting_results")}</p>
        </div>
      </main>
    );
  }

  if (systemMode === "disabled") {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4" dir={dir} lang={locale}>
        <div className="max-w-md mx-auto text-center bg-white rounded-xl border border-gray-200 p-8 shadow-lg">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t(locale, "system_unavailable")}</h1>
          <p className="text-gray-600 mb-6 leading-relaxed">{disabledMessage || t(locale, "no_exams_available")}</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">{t(locale, "go_to_results")}</Link>
        </div>
      </main>
    );
  }

  if (error && !examInfo) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir={dir} lang={locale}>
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {t(locale, "unable_load_exam")}
            </h1>
            <p className="text-gray-600 mb-8 leading-relaxed">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              {t(locale, "try_again")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!examInfo) return null;

  const now = new Date();
  const startTime = examInfo.start_time ? new Date(examInfo.start_time) : null;
  const endTime = examInfo.end_time ? new Date(examInfo.end_time) : null;

  const isNotStarted = startTime && now < startTime;
  const isEnded = endTime && now > endTime;
  function formatDateInCairo(d: Date | null) {
    if (!d) return "";
    try {
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
        timeZone: "Africa/Cairo",
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir={dir} lang={locale}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg backdrop-blur-sm">
          {/* Brand Logo and Name */}
          <div className="mb-8">
            <BrandLogo useAppSettings={true} size="lg" />
          </div>

          {/* Exam Title */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{examInfo.title}</h2>
            {examInfo.description && (
              <p className="text-gray-600 text-sm leading-relaxed">{examInfo.description}</p>
            )}
          </div>

          {/* Exam Status Messages */}
          {isNotStarted && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-amber-800 mb-2">{t(locale, "exam_not_started")}</h3>
              <p className="text-amber-700 text-sm">{t(locale, "exam_available_on", { date: formatDateInCairo(startTime) })}</p>
            </div>
          )}

          {isEnded && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-red-800 mb-2">{t(locale, "exam_ended")}</h3>
              <p className="text-red-700 text-sm">{t(locale, "exam_ended_on", { date: formatDateInCairo(endTime) })}</p>
            </div>
          )}

          {/* Entry Form */}
          {!isNotStarted && !isEnded && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              {/* Code-based access */}
              {examInfo.access_type === "code_based" && (
                <div className="space-y-3">
                  <label htmlFor="exam-code" className="block text-sm font-semibold text-gray-700 mb-3">
                    {t(locale, "exam_code")}
                  </label>
                  <div className="relative">
                    <input
                      id="exam-code"
                      type="text"
                      value={code}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setCode(value);
                      }}
                      className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                      placeholder="0000"
                      maxLength={4}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                    />
                    <div className={`absolute inset-y-0 ${dir === "rtl" ? "left-4" : "right-4"} flex items-center pointer-events-none`}>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2h-6m6 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2h6z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Name input for IP-restricted or open access */}
              {(examInfo.access_type === "ip_restricted" || examInfo.access_type === "open") && (
                <div className="space-y-3">
                  <label htmlFor="student-name" className="block text-sm font-semibold text-gray-700">
                    {t(locale, "student_name")} {examInfo.access_type === "open" && <span className="text-gray-500 font-normal">{t(locale, "optional")}</span>}
                  </label>
                  <div className="relative">
                    <input
                      id="student-name"
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                      placeholder={t(locale, "name_placeholder")}
                      autoComplete="name"
                      required={examInfo.access_type === "ip_restricted"}
                    />
                    <div className={`absolute inset-y-0 ${dir === "rtl" ? "left-4" : "right-4"} flex items-center pointer-events-none`}>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-red-800 text-sm" role="alert">
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={
                  loading ||
                  (examInfo.access_type === "code_based" && !code.trim()) ||
                  (examInfo.access_type === "ip_restricted" && !studentName.trim())
                }
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-md"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t(locale, "starting_exam")}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {t(locale, "continue_to_exam")}
                    <svg
                      className="w-5 h-5"
                      style={{ transform: dir === "rtl" ? "scaleX(-1)" : undefined }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
