"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import ExamEntry from "@/components/public/ExamEntry";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

export default function ExamEntryPage() {
  const [examId, setExamId] = useState<string | null>(null);
  const { locale, dir } = useStudentLocale();

  const routeParams = useParams();
  // Resolve examId from router params with fallback from pathname
  useEffect(() => {
    let id: string | null = null;
    try {
      const v: any = (routeParams as any)?.examId;
      id = typeof v === "string" ? v : Array.isArray(v) ? v[0] : null;
    } catch {}
    if (!id) {
      try {
        const m = window.location.pathname.match(/\/exam\/([^\/?#]+)/);
        if (m) id = decodeURIComponent(m[1]);
      } catch {}
    }
    setExamId(id);
  }, [routeParams]);

  if (!examId) {
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

  return <ExamEntry examId={examId} />;
}
