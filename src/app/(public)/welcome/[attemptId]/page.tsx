"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

interface AppSettings {
  brand_name?: string;
  brand_logo_url?: string;
  welcome_instructions?: string;
  welcome_instructions_ar?: string;
}

interface ExamInfo {
  title: string;
  description: string | null;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
}

interface AttemptInfo {
  student_name: string | null;
  exam_title: string;
  submitted_at: string | null;
  exam: ExamInfo;
}

function WelcomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<AttemptInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { locale, dir } = useStudentLocale();

  function formatDateInCairo(loc: string, iso: string) {
    try {
      const dt = new Date(iso);
      return new Intl.DateTimeFormat(loc, {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(dt);
    } catch {
      try { return new Date(iso).toLocaleString(loc); } catch { return iso; }
    }
  }

  const studentName = searchParams.get('name') || 'Student';

  const routeParams = useParams();
  // Resolve attemptId with fallback from pathname
  useEffect(() => {
    let id: string | null = null;
    try {
      const v: any = (routeParams as any)?.attemptId;
      id = typeof v === "string" ? v : Array.isArray(v) ? v[0] : null;
    } catch {}
    if (!id) {
      try {
        const m = window.location.pathname.match(/\/welcome\/([^\/?#]+)/);
        if (m) id = decodeURIComponent(m[1]);
      } catch {}
    }
    setAttemptId(id);
  }, [routeParams]);

  // Fetch app settings and attempt info
  useEffect(() => {
    if (!attemptId) return;

    async function fetchData() {
      try {
        // Fetch both settings and attempt info in parallel
        const [settingsRes, attemptRes] = await Promise.all([
          fetch('/api/public/settings'),
          fetch(`/api/attempts/${attemptId}/info`)
        ]);

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setAppSettings(settingsData);
        }

        if (attemptRes.ok) {
          const attemptData = await attemptRes.json();
          setAttemptInfo(attemptData);
        } else {
          setError("Failed to load exam information");
        }
      } catch (e: any) {
        setError("Failed to load exam information");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [attemptId]);

  const handleStartExam = () => {
    if (attemptId) {
      const attemptUrl = `/attempt/${attemptId}`;
      
      // Use window.location for better compatibility with old browsers
      try {
        router.push(attemptUrl);
      } catch (error) {
        // Fallback for old browsers
        window.location.href = attemptUrl;
      }
    }
  };

  if (loading) {
    return (
      <main dir={dir} lang={locale} className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-[var(--muted-foreground)]">{t(locale, "loading_instructions")}</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main dir={dir} lang={locale} className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
            {t(locale, "unable_load_instructions")}
          </h1>
          <p className="text-[var(--muted-foreground)] mb-6">{error}</p>
          <button
            onClick={handleStartExam}
            className="btn btn-primary"
          >
            {t(locale, "continue_to_exam")}
          </button>
        </div>
      </main>
    );
  }

  // Process instructions (choose locale-specific variant) and replace @name placeholder
  const rawInstructions =
    (locale === "ar" ? appSettings?.welcome_instructions_ar : undefined) ??
    appSettings?.welcome_instructions ??
    "";
  const processedInstructions = rawInstructions.replace(/@name/g, studentName);

  return (
    <main dir={dir} lang={locale} className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-8 shadow-sm">
          {/* Brand Logo and Name */}
          <div className="mb-6">
            <BrandLogo
              useAppSettings={true}
              size="md"
            />
          </div>

          {/* Welcome Header */}
          <div className="mb-0 flex flex-col items-center text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center" style={{ lineHeight: 0 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 block">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
              {t(locale, "welcome_title", { name: studentName })}
            </h1>
            <p className="text-[var(--muted-foreground)]">{t(locale, "welcome_hint")}</p>
          </div>

          {/* Instructions */}
          <div className="bg-[var(--muted)]/30 rounded-lg p-6 mb-8">
            <div className="prose prose-sm max-w-none text-[var(--foreground)]">
              {processedInstructions.split('\n').map((line, index) => (
                <p key={index} className="mb-3 last:mb-0">
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Default Instructions if none provided in any language */}
          {!(appSettings?.welcome_instructions || appSettings?.welcome_instructions_ar) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-blue-900 mb-3">{t(locale, "default_instructions_title")}</h3>
              <ul className="text-blue-800 text-sm space-y-2">
                <li>• {t(locale, "default_instruction_1")}</li>
                <li>• {t(locale, "default_instruction_2")}</li>
                <li>• {t(locale, "default_instruction_3")}</li>
                <li>• {t(locale, "default_instruction_4")}</li>
                <li>• {t(locale, "default_instruction_5")}</li>
              </ul>
            </div>
          )}

          {/* Exam Information */}
          {attemptInfo?.exam && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">{t(locale, "exam_information")}</h3>
              <div className="space-y-3 text-sm text-gray-600">
                {attemptInfo.exam.duration_minutes && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t(locale, "duration")}
                    </span>
                    <span className="font-medium text-gray-800">{attemptInfo.exam.duration_minutes} {t(locale, "minutes")}</span>
                  </div>
                )}
                {attemptInfo.exam.start_time && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {t(locale, "available_from")}
                    </span>
                    <span className="font-medium text-gray-800">{formatDateInCairo(locale, attemptInfo.exam.start_time)}</span>
                  </div>
                )}
                {attemptInfo.exam.end_time && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {t(locale, "available_until")}
                    </span>
                    <span className="font-medium text-gray-800">{formatDateInCairo(locale, attemptInfo.exam.end_time)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.back()}
              className="btn btn-outline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: dir === 'rtl' ? 'scaleX(-1)' : undefined }}>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {t(locale, "go_back")}
            </button>
            <button
              onClick={handleStartExam}
              className="btn btn-primary"
            >
              {t(locale, "start_exam")}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: dir === 'rtl' ? 'scaleX(-1)' : undefined }}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-xs text-[var(--muted-foreground)]">
              {t(locale, "footer_good_luck")}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<LocalizedFallback />}>
      <WelcomePageInner />
    </Suspense>
  );
}

function LocalizedFallback() {
  const { locale, dir } = useStudentLocale();
  return (
    <main dir={dir} lang={locale} className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-[var(--muted-foreground)]">{t(locale, "loading_instructions")}</p>
      </div>
    </main>
  );
}