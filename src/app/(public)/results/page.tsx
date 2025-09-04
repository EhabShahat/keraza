"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import BrandLogo from "@/components/BrandLogo";
import { useRouter } from "next/navigation";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

interface ExamResult {
  id: string;
  exam_id: string;
  exam_title: string;
  student_name: string;
  student_code: string;
  completion_status: string;
  submitted_at: string | null;
  score_percentage: number | null;
  is_pass?: boolean | null;
  pass_threshold?: number | null;
}

interface PublicSettings {
  brand_name?: string;
  brand_logo_url?: string;
  enable_name_search?: boolean;
  enable_code_search?: boolean;
}

export default function PublicResultsPage({
  initialSystemMode,
  initialDisabledMessage,
  skipModeFetch = !!initialSystemMode,
}: {
  initialSystemMode?: 'exam' | 'results' | 'disabled';
  initialDisabledMessage?: string | null;
  skipModeFetch?: boolean;
} = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [effectiveMode, setEffectiveMode] = useState<"name" | "code">("name");
  const [settings, setSettings] = useState<PublicSettings>({});
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  
  
  const router = useRouter();
  const [systemMode, setSystemMode] = useState<'exam' | 'results' | 'disabled' | null>(initialSystemMode ?? null);
  const [disabledMessage, setDisabledMessage] = useState<string | null>(initialDisabledMessage ?? null);
  const { locale, dir } = useStudentLocale();
  
  // Fetch app settings
  const settingsQuery = useQuery<PublicSettings, Error>({
    queryKey: ["public", "settings"],
    enabled: systemMode === 'results',
    queryFn: async () => {
      try {
        const res = await fetch("/api/public/settings");
        if (!res.ok) {
          console.error("Settings API error:", res.status, res.statusText);
          return {}; // Return empty object on error to prevent UI breaking
        }
        const data = await res.json();
        return data || {};
      } catch (error) {
        console.error("Settings fetch error:", error);
        return {}; // Return empty object on error
      }
    },
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });

  const isCodeMode = effectiveMode === "code";
  const is4Digits = /^\d{4}$/.test(searchTerm.trim());

  // Validate code existence when in code mode and we have 4 digits
  const codeValidationQuery = useQuery<boolean, Error>({
    queryKey: ["public", "validate-code", searchTerm],
    enabled: systemMode === 'results' && isCodeMode && is4Digits,
    queryFn: async () => {
      const res = await fetch(`/api/public/validate-code?code=${encodeURIComponent(searchTerm.trim())}`);
      if (!res.ok) throw new Error("Validation failed");
      const data = await res.json();
      return !!data.valid;
    },
    staleTime: 30000,
  });

  const canSearch = isCodeMode
    ? (is4Digits && codeValidationQuery.data === true)
    : searchTerm.trim().length > 0;

  // Fetch filtered exam results from server only when user enters a term
  const resultsQuery = useQuery<ExamResult[], Error>({
    enabled: systemMode === 'results' && canSearch,
    queryKey: ["public", "results", searchTerm, effectiveMode],
    queryFn: async () => {
      try {
        const q = encodeURIComponent(searchTerm.trim());
        const res = await fetch(`/api/public/results?q=${q}`);
        if (!res.ok) {
          console.error("Results API error:", res.status, res.statusText);
          throw new Error(res.statusText || "Failed to load results");
        }
        const data = await res.json();
        return (data.items as ExamResult[]) || [];
      } catch (error) {
        console.error("Results fetch error:", error);
        throw error; // Rethrow to show error UI
      }
    },
    retry: 2, // Retry failed requests 2 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });

  // Update settings when the query completes
  useEffect(() => {
    if (settingsQuery.data) {
      const enableName = settingsQuery.data.enable_name_search !== false;
      const enableCode = settingsQuery.data.enable_code_search !== false;
      // Preserve branding fields in settings as well
      setSettings({
        brand_name: settingsQuery.data.brand_name,
        brand_logo_url: settingsQuery.data.brand_logo_url,
        enable_name_search: enableName,
        enable_code_search: enableCode,
      });
      const mode = enableCode && !enableName ? "code" : "name";
      setEffectiveMode(mode);
    }
  }, [settingsQuery.data]);
  
  // Fetch system mode & disabled message
  useEffect(() => {
    if (skipModeFetch) return; // SSR provided system mode; avoid re-fetch
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/system-mode');
        if (!res.ok) throw new Error('Failed to fetch system mode');
        const data = await res.json();
        if (!cancelled) {
          setSystemMode((data?.mode as 'exam' | 'results' | 'disabled') ?? 'results');
          setDisabledMessage(data?.message ?? null);
        }
      } catch (e) {
        console.error('System mode fetch error:', e);
        if (!cancelled) setSystemMode('results');
      }
    })();
    return () => { cancelled = true; };
  }, [skipModeFetch]);

  // Redirect if in exam mode
  useEffect(() => {
    if (systemMode === 'exam') {
      router.push('/');
    }
  }, [systemMode, router]);

  // Reveal results and scroll into view
  useEffect(() => {
    if (systemMode === 'results' && resultsQuery.data) {
      setShowResults(true);
      setTimeout(() => { try { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { try { (resultsRef.current as any)?.scrollIntoView?.(true); } catch {} } }, 50);
    }
  }, [systemMode, resultsQuery.data]);

  // Tri-state UI rendering
  if (systemMode === null) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-600">
          <div className="w-8 h-8 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          {t(locale, "loading_generic")}
        </div>
      </main>
    );
  }

  if (systemMode === 'disabled') {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-xl mx-auto px-4 py-16">
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-semibold mb-2">{t(locale, "results_unavailable")}</h1>
            <p className="text-gray-600 mb-6">{disabledMessage || t(locale, "results_portal_unavailable")}</p>
            <a href="/" className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">{t(locale, "go_home")}</a>
          </div>
        </div>
      </main>
    );
  }

  // Results mode UI
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo useAppSettings={true} size="lg" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{settings.brand_name || t(locale, "exam_system")}</h1>
          <p className="mt-2 text-gray-600">{isCodeMode ? t(locale, "results_search_hint_code") : t(locale, "results_search_hint_name")}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {isCodeMode ? (
            <div className="space-y-3">
              <label htmlFor="results-code" className="block text-sm font-semibold text-gray-700">{t(locale, "exam_code")}</label>
              <div className="relative">
                <input
                  id="results-code"
                  type="text"
                  inputMode="numeric"
                  value={searchTerm}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setSearchTerm(v);
                  }}
                  className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="0000"
                  maxLength={4}
                  autoComplete="one-time-code"
                />
                <div className={`absolute inset-y-0 ${dir === 'rtl' ? 'left-4' : 'right-4'} flex items-center pointer-events-none`}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2h-6m6 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2h6z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center">{t(locale, "exam_code_hint")}</p>
              <div className="min-h-[18px] text-xs text-center">
                {!searchTerm.trim() ? (
                  <span className="text-gray-500">&nbsp;</span>
                ) : !is4Digits ? (
                  <span className="text-yellow-700">{t(locale, "code_must_be_4_digits")}</span>
                ) : codeValidationQuery.isFetching ? (
                  <span className="text-blue-700">{t(locale, "checking_code")}</span>
                ) : codeValidationQuery.data === true ? (
                  <span className="text-green-700">{t(locale, "code_verified")}</span>
                ) : (
                  <span className="text-red-700">{t(locale, "code_not_found")}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label htmlFor="results-name" className="block text-sm font-semibold text-gray-700">{t(locale, "student_name")}</label>
              <div className="relative">
                <input
                  id="results-name"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder={t(locale, "name_placeholder")}
                  autoComplete="name"
                />
                <div className={`absolute inset-y-0 ${dir === 'rtl' ? 'left-4' : 'right-4'} flex items-center pointer-events-none`}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          <button
            className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg"
            onClick={() => { if (canSearch) resultsQuery.refetch(); }}
            disabled={!canSearch || resultsQuery.isFetching}
          >
            {resultsQuery.isFetching ? t(locale, 'searching') : (isCodeMode ? t(locale, 'find_results') : t(locale, 'search_results'))}
          </button>
        </div>

        <div
          ref={resultsRef}
          className={`mt-6 transition-all duration-500 ease-out transform ${showResults ? 'opacity-100 translate-y-0 max-h-[2000px]' : 'opacity-0 -translate-y-2 max-h-0'} overflow-hidden`}
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
            {searchTerm.trim().length === 0 ? (
              <div className="text-center text-gray-600 py-4">{isCodeMode ? t(locale, 'enter_code_to_view_results') : t(locale, 'enter_name_to_view_results')}</div>
            ) : resultsQuery.isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : resultsQuery.error ? (
              <div className="text-center text-red-600 py-6">
                <div className="text-4xl mb-2">⚠️</div>
                <h3 className="text-lg font-medium mb-1">{t(locale, 'error_loading_results')}</h3>
                <p>{resultsQuery.error.message}</p>
              </div>
            ) : (resultsQuery.data || []).length === 0 ? (
              <div className="text-center text-gray-600 py-4">{t(locale, 'no_results_found')}</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {(resultsQuery.data || []).map((r: ExamResult) => (
                  <li key={r.id} className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="pr-4">
                        <div className="font-semibold text-gray-900">{r.exam_title}</div>
                        <div className="text-sm text-gray-500">
                          {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {typeof r.score_percentage === 'number' ? (
                          <div className={`font-bold text-lg px-3 py-1 rounded-lg ${
                            r.score_percentage >= 80 ? 'bg-green-50 text-green-700' :
                            r.score_percentage >= 60 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {r.score_percentage}%
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                        {r.is_pass === true ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            {t(locale, 'pass')}
                          </span>
                        ) : r.is_pass === false ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            {t(locale, 'fail')}
                          </span>
                        ) : (typeof r.score_percentage === 'number' && typeof r.pass_threshold === 'number') ? (
                          (r.score_percentage >= r.pass_threshold ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">{t(locale, 'pass')}</span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">{t(locale, 'fail')}</span>
                          ))
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}