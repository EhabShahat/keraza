"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { resolveStudentLocale, type StudentLocale, getDir } from "@/i18n/student";

interface Ctx {
  locale: StudentLocale;
  dir: "ltr" | "rtl";
}

const LocaleCtx = createContext<Ctx>({ locale: "en", dir: "ltr" });

export function useStudentLocale(): Ctx {
  return useContext(LocaleCtx);
}

export default function PublicLocaleProvider({ children }: { children: React.ReactNode }) {
  // Initialize from SSR-provided <html lang> to avoid client flip from en->ar on mount
  const [locale, setLocale] = useState<StudentLocale>(() => {
    if (typeof document !== "undefined") {
      const lang = document.documentElement.getAttribute("lang");
      return lang === "ar" ? "ar" : "en";
    }
    return "en";
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/settings", { cache: "no-store" });
        if (!res.ok) return;
        const settings = await res.json();
        if (cancelled) return;
        setLocale(resolveStudentLocale(settings));
      } catch {
        // ignore; keep default
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dir = useMemo(() => getDir(locale), [locale]);

  const value = useMemo(() => ({ locale, dir }), [locale, dir]);

  return (
    <LocaleCtx.Provider value={value}>
      <div dir={dir} lang={locale}>{children}</div>
    </LocaleCtx.Provider>
  );
}
