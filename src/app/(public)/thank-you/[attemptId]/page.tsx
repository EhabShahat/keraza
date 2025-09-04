"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

interface AppSettings {
  brand_name?: string;
  brand_logo_url?: string;
  thank_you_title?: string;
  thank_you_title_ar?: string;
  thank_you_message?: string;
  thank_you_message_ar?: string;
}

interface AttemptInfo {
  student_name?: string;
  exam_title?: string;
  submitted_at?: string;
}

export default function ThankYouPage() {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<AttemptInfo | null>(null);
  const [loading, setLoading] = useState(true);
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

  const routeParams = useParams();
  // Resolve attemptId from router params with fallback from pathname
  useEffect(() => {
    let id: string | null = null;
    try {
      const v: any = (routeParams as any)?.attemptId;
      id = typeof v === "string" ? v : Array.isArray(v) ? v[0] : null;
    } catch {}
    if (!id) {
      try {
        const m = window.location.pathname.match(/\/thank-you\/([^\/?#]+)/);
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
        // Fetch app settings
        const settingsRes = await fetch('/api/public/settings');
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setAppSettings(settingsData);
        }

        // Fetch attempt info
        const attemptRes = await fetch(`/api/attempts/${attemptId}/info`);
        if (attemptRes.ok) {
          const attemptData = await attemptRes.json();
          setAttemptInfo(attemptData);
        }
      } catch (e) {
        // Continue without data if fetch fails
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [attemptId]);

  if (loading) {
    return (
      <main dir={dir} lang={locale} className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-[var(--muted-foreground)]">{t(locale, "loading_generic")}</p>
        </div>
      </main>
    );
  }

  const studentName = attemptInfo?.student_name || 'Student';
  const examTitle = attemptInfo?.exam_title || 'Exam';
  const submittedAt = attemptInfo?.submitted_at ? formatDateInCairo(locale, attemptInfo.submitted_at) : null;

  const thankTitle =
    (locale === "ar" ? appSettings?.thank_you_title_ar : undefined) ??
    appSettings?.thank_you_title ??
    t(locale, "thank_you");
  const thankMessage =
    (locale === "ar" ? appSettings?.thank_you_message_ar : undefined) ??
    appSettings?.thank_you_message ??
    t(locale, "thank_you_default_message");

  return (
    <main dir={dir} lang={locale} className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-8 shadow-sm text-center">
          {/* Brand Logo and Name */}
          <div className="mb-6">
            <BrandLogo
              useAppSettings={true}
              size="md"
            />
          </div>

          {/* Success Icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center" style={{ lineHeight: 0 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 block">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>

          {/* Thank You Message */}
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-4">
            {thankTitle}
          </h1>
          
          <p className="text-lg text-[var(--muted-foreground)] mb-6">{thankMessage}</p>

          {/* Exam Details */}
          <div className="bg-[var(--muted)]/30 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-[var(--foreground)] mb-3">{t(locale, "submission_details")}</h3>
            <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <div className="flex justify-between items-center">
                <span>{t(locale, "exam_label")}</span>
                <span className="font-medium text-[var(--foreground)]">{examTitle}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t(locale, "student_label")}</span>
                <span className="font-medium text-[var(--foreground)]">{attemptInfo?.student_name || 'Student'}</span>
              </div>
              {submittedAt && (
                <div className="flex justify-between items-center">
                  <span>{t(locale, "submitted_label")}</span>
                  <span className="font-medium text-[var(--foreground)]">{submittedAt}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span>{t(locale, "status_label")}</span>
                <span className="font-medium text-green-600">{t(locale, "completed")}</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">{t(locale, "thank_you_default_message")}</p>
          </div>

          {/* Action Button */}
          <button
            onClick={() => window.close()}
            className="btn btn-primary"
          >
            {t(locale, "close_window")}
          </button>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)]">{t(locale, "help_contact_instructor")}</p>
          </div>
        </div>
      </div>
    </main>
  );
}