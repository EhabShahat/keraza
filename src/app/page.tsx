import { supabaseServer } from "@/lib/supabase/server";
import PublicLocaleProvider from "@/components/public/PublicLocaleProvider";
import PublicResultsPage from "./(public)/results/page";
import MultiExamEntry from "@/components/public/MultiExamEntry";
import Link from "next/link";
import { resolveStudentLocale, getDir, type StudentLocale, t } from "@/i18n/student";

type MinimalExam = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  access_type: "open" | "code_based" | "ip_restricted";
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  console.log("🏠 Home page loading...");
  
  let svc;
  try {
    svc = supabaseServer();
    console.log("✅ Supabase client created");
  } catch (error) {
    console.error("❌ Failed to create Supabase client:", error);
    return <ErrorPage message="Database connection failed" />;
  }

  // Read tri-state system mode from app_config
  console.log("🧭 Checking system mode...");
  const { data: cfg, error: cfgErr } = await svc
    .from("app_config")
    .select("key, value")
    .in("key", ["system_mode", "system_disabled", "system_disabled_message"]);
  if (cfgErr) {
    console.warn("⚠️ Failed to read app_config, defaulting to exam mode:", cfgErr.message);
  }

  type AppConfigRow = { key: string; value: string | null };
  const cfgMap = new Map<string, string | null>();
  for (const row of cfg || []) {
    const r = row as AppConfigRow;
    cfgMap.set(r.key, r.value);
  }
  const legacyDisabled = cfgMap.get("system_disabled") === "true";
  const mode = (cfgMap.get("system_mode") as "exam" | "results" | "disabled" | undefined) || (legacyDisabled ? "disabled" : "exam");
  console.log("🧭 System mode:", mode);

  if (mode === "disabled") {
    const message = cfgMap.get("system_disabled_message") || "No exams are currently available. Please check back later.";
    return <SystemDisabledPage message={message} />;
  }
  if (mode === "results") {
    console.log("🧾 Rendering results on root due to system mode");
    return (
      <PublicLocaleProvider>
        <PublicResultsPage initialSystemMode="results" skipModeFetch />
      </PublicLocaleProvider>
    );
  }
  // Exam mode: render multi-exam entry (code-based selection)
  console.log("🚀 Rendering MultiExamEntry on root (exam mode)");
  return (
    <PublicLocaleProvider>
      <MultiExamEntry />
    </PublicLocaleProvider>
  );
}

function NoExamsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="max-w-md mx-auto text-center p-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          No Exams Available
        </h1>
        <p className="text-[var(--muted-foreground)] mb-6 leading-relaxed">
          There are currently no active exams available. Please check back later or contact your instructor.
        </p>
        <div className="text-sm text-[var(--muted-foreground)]">
          If you believe this is an error, please contact your administrator.
        </div>
      </div>
    </div>
  );
}

function ExamNotStartedPage({ exam, startTime, locale }: { exam: MinimalExam; startTime: Date; locale: StudentLocale }) {
  function formatDateInCairo(dt: Date, loc: StudentLocale) {
    try {
      return new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-US", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
        timeZone: "Africa/Cairo",
      }).format(dt);
     } catch {
       return dt.toLocaleString();
     }
   }
  const formatted = formatDateInCairo(startTime, locale);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]" dir={getDir(locale)} lang={locale}>
      <div className="max-w-md mx-auto text-center p-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-yellow-100 rounded-full flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-600">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          {t(locale, "exam_not_started")}
        </h1>
        <p className="text-[var(--muted-foreground)] mb-4">
          <strong>{exam.title}</strong>
        </p>
        <p className="text-[var(--muted-foreground)] mb-6 leading-relaxed">
          {t(locale, "exam_available_on", { date: formatted })}
        </p>
        <div className="text-sm text-[var(--muted-foreground)]">
          {t(locale, "check_back_scheduled_time")}
        </div>
      </div>
    </div>
  );
}

function ExamEndedPage({ exam, endTime, locale }: { exam: MinimalExam; endTime: Date; locale: StudentLocale }) {
  function formatDateInCairo(dt: Date, loc: StudentLocale) {
    try {
      return new Intl.DateTimeFormat(loc === "ar" ? "ar-EG" : "en-US", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
        timeZone: "Africa/Cairo",
      }).format(dt);
    } catch {
      return dt.toLocaleString();
    }
  }
  const formatted = formatDateInCairo(endTime, locale);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]" dir={getDir(locale)} lang={locale}>
      <div className="max-w-md mx-auto text-center p-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          {t(locale, "exam_ended")}
        </h1>
        <p className="text-[var(--muted-foreground)] mb-4">
          <strong>{exam.title}</strong>
        </p>
        <p className="text-[var(--muted-foreground)] mb-6 leading-relaxed">
          {t(locale, "exam_ended_on", { date: formatted })}
        </p>
        <div className="text-sm text-[var(--muted-foreground)]">
          {t(locale, "help_contact_instructor")}
        </div>
      </div>
    </div>
  );
}

function SystemDisabledPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="max-w-md mx-auto text-center p-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          System Unavailable
        </h1>
        <p className="text-[var(--muted-foreground)] mb-6 leading-relaxed">
          {message}
        </p>
        <div className="text-sm text-[var(--muted-foreground)]">
          Please check back later or contact your administrator.
        </div>
      </div>
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="max-w-md mx-auto text-center p-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          Service Unavailable
        </h1>
        <p className="text-[var(--muted-foreground)] mb-6 leading-relaxed">
          {message}. Please try again later.
        </p>
        <div className="text-sm text-[var(--muted-foreground)]">
          Please refresh the page or contact your administrator.
        </div>
        <div className="mt-4">
          <Link href="/" className="btn btn-primary btn-sm">
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}
