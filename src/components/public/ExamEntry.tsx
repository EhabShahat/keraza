"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";
import type { CodeFormatSettings } from "@/lib/codeGenerator";

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
  deviceInfo?: any;
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
  const [codeSettings, setCodeSettings] = useState<CodeFormatSettings | null>(null);
  const submitClicksRef = useRef<{ count: number; timestamps: string[] }>({ count: 0, timestamps: [] });

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

  // Fetch code format settings on mount
  useEffect(() => {
    async function fetchCodeSettings() {
      try {
        const res = await fetch("/api/public/code-settings", { cache: "no-store" });
        if (res.ok) {
          const settings = await res.json();
          setCodeSettings(settings);
        }
      } catch (error) {
        console.warn("Failed to fetch code settings, using defaults");
        setCodeSettings({
          code_length: 4,
          code_format: "numeric",
          code_pattern: null,
        });
      }
    }
    void fetchCodeSettings();
  }, []);

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

  async function handleSubmit() {
    if (!examInfo) return;

    try {
      setLoading(true);
      setError(null);

      async function collectDeviceInfo() {
        try {
          const nav = typeof navigator !== "undefined" ? (navigator as any) : ({} as any);
          const scr = typeof screen !== "undefined" ? (screen as any) : ({} as any);
          const win = typeof window !== "undefined" ? (window as any) : ({} as any);

          const tz = (() => {
            try {
              return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
            } catch {
              return null;
            }
          })();

          // User-Agent Client Hints (Chromium)
          const uaData = nav.userAgentData ? {
            platform: nav.userAgentData.platform ?? null,
            mobile: typeof nav.userAgentData.mobile === "boolean" ? nav.userAgentData.mobile : null,
            brands: Array.isArray(nav.userAgentData.brands) ? nav.userAgentData.brands : null,
          } : null;

          // High-entropy UA-CH values (may provide device model on Android Chrome)
          let uaHigh: any = null;
          try {
            if (nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === "function") {
              uaHigh = await nav.userAgentData.getHighEntropyValues([
                "model",
                "platformVersion",
                "uaFullVersion",
              ]);
            }
          } catch {}

          const ua: string = typeof nav.userAgent === "string" ? nav.userAgent : "";

          function parseUA(uaStr: string) {
            try {
              const b: any = { name: null, version: null };
              const o: any = { name: null, version: null };
              const d: any = { type: null };

              // Browser
              const mEdge = uaStr.match(/Edg\/(\d+\.?\d*)/);
              const mOpera = uaStr.match(/OPR\/(\d+\.?\d*)/);
              const mChrome = uaStr.match(/Chrome\/(\d+\.?\d*)/);
              const mFirefox = uaStr.match(/Firefox\/(\d+\.?\d*)/);
              const mSafariV = uaStr.match(/Version\/(\d+\.?\d*).*Safari/);
              if (mEdge) { b.name = "Edge"; b.version = mEdge[1]; }
              else if (mOpera) { b.name = "Opera"; b.version = mOpera[1]; }
              else if (mChrome) { b.name = "Chrome"; b.version = mChrome[1]; }
              else if (mFirefox) { b.name = "Firefox"; b.version = mFirefox[1]; }
              else if (mSafariV) { b.name = "Safari"; b.version = mSafariV[1]; }

              // OS
              const mWin = uaStr.match(/Windows NT (\d+\.\d+)/);
              const mMac = uaStr.match(/Mac OS X (\d+[_.]\d+(?:[_.]\d+)?)/);
              const mIOS = uaStr.match(/(?:iPhone|iPad|iPod).*OS (\d+[_\.]\d+(?:[_\.]\d+)?)/);
              const mAndroid = uaStr.match(/Android (\d+(?:\.\d+)?)/);
              if (mWin) {
                const ver = mWin[1];
                const map: Record<string,string> = {"10.0":"Windows 10/11","6.3":"Windows 8.1","6.2":"Windows 8","6.1":"Windows 7","6.0":"Windows Vista","5.1":"Windows XP","5.2":"Windows XP"};
                o.name = "Windows"; o.version = map[ver] || ver;
              } else if (mIOS) {
                o.name = "iOS"; o.version = mIOS[1].replace(/_/g, ".");
              } else if (mMac) {
                o.name = "macOS"; o.version = mMac[1].replace(/_/g, ".");
              } else if (mAndroid) {
                o.name = "Android"; o.version = mAndroid[1];
              } else if (/CrOS/.test(uaStr)) {
                o.name = "ChromeOS"; o.version = null;
              } else if (/Linux/.test(uaStr)) {
                o.name = "Linux"; o.version = null;
              }

              // Device type
              if (uaData?.mobile === true || /Mobi|Android/.test(uaStr)) d.type = "mobile";
              else if (/iPad|Tablet/.test(uaStr)) d.type = "tablet";
              else d.type = "desktop";

              return { browser: b, os: o, device: d };
            } catch {
              return { browser: { name: null, version: null }, os: { name: null, version: null }, device: { type: null } };
            }
          }

          const parsed = parseUA(ua);

          // Attempt to derive device model from UA when UA-CH is unavailable
          const modelFromUA = (() => {
            try {
              // Android pattern: "; <MODEL> Build/"
              const m1 = ua.match(/;\s*([A-Za-z0-9_\- ]+)\s+Build\//);
              if (m1 && m1[1]) return m1[1].trim();
              // Google Pixel pattern
              const mPixel = ua.match(/(Pixel\s+[A-Za-z0-9 ]+)/);
              if (mPixel && mPixel[1]) return mPixel[1].trim();
              // iOS devices
              if (/iPhone/.test(ua)) return "iPhone";
              if (/iPad/.test(ua)) return "iPad";
              if (/iPod/.test(ua)) return "iPod";
              return null;
            } catch { return null; }
          })();

          const deviceModel: string | null = (uaHigh?.model && typeof uaHigh.model === "string" && uaHigh.model.trim()) ? uaHigh.model : (modelFromUA || null);

          function inferVendor(osName?: string | null, model?: string | null, uaStr?: string | null): string | null {
            const m = (model || "").toUpperCase();
            const u = (uaStr || "").toUpperCase();
            const os = (osName || "").toUpperCase();

            // iOS devices are Apple
            if (os.includes("IOS") || /IPHONE|IPAD|IPOD/.test(m) || /IPHONE|IPAD|IPOD/.test(u)) return "Apple";

            // Samsung
            if (/^SM[-_]/.test(m) || /^GT[-_]/.test(m) || u.includes("SAMSUNG")) return "Samsung";

            // OPPO / realme / OnePlus (BBK group)
            if (/^CPH/.test(m) || u.includes("OPPO")) return "OPPO";
            if (/^RMX/.test(m) || u.includes("REALME")) return "realme";
            if (m.includes("ONEPLUS") || u.includes("ONEPLUS")) return "OnePlus";

            // Xiaomi family
            if (/(^MI\d+\b)|(^MIX\b)|\bREDMI\b/.test(m) || /\bPOCO\b/.test(m) || u.includes("XIAOMI") || u.includes("REDMI") || u.includes("POCO")) {
              if (/\bPOCO\b/.test(m) || u.includes("POCO")) return "POCO";
              if (/\bREDMI\b/.test(m) || u.includes("REDMI")) return "Redmi";
              return "Xiaomi";
            }

            // Huawei / Honor
            if (u.includes("HUAWEI") || /^HUAWEI/.test(m) || /\bVOG-|\bANE-|\bLYA-|\bPRA-|\bELE-/.test(m)) return "Huawei";
            if (u.includes("HONOR") || /^HONOR/.test(m)) return "Honor";

            // vivo
            if (u.includes("VIVO") || /^V\d{3,}/.test(m)) return "vivo";

            // Motorola
            if (u.includes("MOTOROLA") || /^XT\d+/.test(m) || m.startsWith("MOTO")) return "Motorola";

            // Nokia
            if (u.includes("NOKIA") || /^TA-\d+/.test(m)) return "Nokia";

            // Google Pixel
            if (m.includes("PIXEL") || u.includes("PIXEL")) return "Google";

            // Sony
            if (u.includes("SONY") || /^XQ-/.test(m) || m.includes("XPERIA")) return "Sony";

            // LG
            if (u.includes("LG") || /^LM-/.test(m) || m.startsWith("LGM")) return "LG";

            // ZTE / Nubia
            if (u.includes("ZTE") || /^NX\d+/.test(m) || u.includes("NUBIA")) return "ZTE";

            // Infinix / Tecno / Itel (Transsion)
            if (u.includes("INFINIX")) return "Infinix";
            if (u.includes("TECNO")) return "Tecno";
            if (u.includes("ITEL")) return "itel";

            return null;
          }

          const deviceBrand = inferVendor(parsed?.os?.name || null, deviceModel, ua);
          const oem = (deviceBrand || deviceModel) ? {
            brand: deviceBrand || null,
            model: deviceModel || null,
            source: uaHigh?.model ? "ua-ch" : (modelFromUA ? "ua" : null),
          } : null;

          // Screen / orientation / viewport
          const orientation = (() => {
            try {
              const so = scr.orientation || win.screen?.orientation;
              return so ? { type: so.type ?? null, angle: typeof so.angle === "number" ? so.angle : null } : null;
            } catch { return null; }
          })();
          const viewport = (() => {
            try {
              const iw = typeof win.innerWidth === "number" ? win.innerWidth : null;
              const ih = typeof win.innerHeight === "number" ? win.innerHeight : null;
              return iw && ih ? { width: iw, height: ih } : null;
            } catch { return null; }
          })();

          // Network (where supported)
          const conn = nav.connection || nav.mozConnection || nav.webkitConnection || null;
          const network = conn ? {
            type: conn.type ?? null,
            effectiveType: conn.effectiveType ?? null,
            downlink: typeof conn.downlink === "number" ? conn.downlink : null,
            rtt: typeof conn.rtt === "number" ? conn.rtt : null,
            saveData: typeof conn.saveData === "boolean" ? conn.saveData : null,
          } : null;

          // Battery (optional)
          let battery: any = null;
          try {
            if (typeof nav.getBattery === "function") {
              const b = await nav.getBattery();
              battery = {
                level: typeof b.level === "number" ? Math.round(b.level * 100) : null,
                charging: typeof b.charging === "boolean" ? b.charging : null,
                chargingTime: typeof b.chargingTime === "number" ? b.chargingTime : null,
                dischargingTime: typeof b.dischargingTime === "number" ? b.dischargingTime : null,
              };
            }
          } catch {}

          // Storage estimate (optional)
          let storage: any = null;
          try {
            if (nav.storage && typeof nav.storage.estimate === "function") {
              const est = await nav.storage.estimate();
              storage = {
                usage: typeof est.usage === "number" ? est.usage : null,
                quota: typeof est.quota === "number" ? est.quota : null,
              };
            }
          } catch {}

          // GPU (WebGL renderer info)
          let gpu: any = null;
          try {
            const canvas = document.createElement("canvas");
            const gl: any = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (gl) {
              const dbg = gl.getExtension("WEBGL_debug_renderer_info");
              if (dbg) {
                const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
                const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
                gpu = { vendor, renderer };
              }
            }
          } catch {}

          const clicks = submitClicksRef?.current || { count: 0, timestamps: [] as string[] };

          return {
            collectedAt: new Date().toISOString(),
            userAgent: ua || null,
            platform: nav.platform ?? null,
            language: nav.language ?? null,
            languages: Array.isArray(nav.languages) ? nav.languages : null,
            vendor: nav.vendor ?? null,
            deviceMemory: nav.deviceMemory ?? null,
            hardwareConcurrency: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
            pixelRatio: typeof win.devicePixelRatio === "number" ? win.devicePixelRatio : null,
            timezone: tz,
            timezoneOffset: (() => { try { return new Date().getTimezoneOffset(); } catch { return null; } })(),
            touch: typeof win === "object" ? ("ontouchstart" in win || (nav as any).maxTouchPoints > 0) : null,
            screen: {
              width: scr.width ?? null,
              height: scr.height ?? null,
              availWidth: scr.availWidth ?? null,
              availHeight: scr.availHeight ?? null,
              colorDepth: scr.colorDepth ?? null,
              pixelDepth: scr.pixelDepth ?? null,
            },
            viewport,
            orientation,
            uaData,
            parsed,
            oem,
            network,
            battery,
            storage,
            gpu,
            entrySubmit: {
              count: typeof clicks.count === "number" ? clicks.count : 0,
              firstAt: clicks.timestamps && clicks.timestamps.length ? clicks.timestamps[0] : null,
              lastAt: clicks.timestamps && clicks.timestamps.length ? clicks.timestamps[clicks.timestamps.length - 1] : null,
              timestamps: Array.isArray(clicks.timestamps) ? clicks.timestamps.slice(0, 20) : [],
            },
          };
        } catch {
          return null;
        }
      }

      const deviceInfo = await collectDeviceInfo();

      const requestBody: AccessBody =
        examInfo.access_type === "code_based"
          ? { code: code || null, studentName: null, deviceInfo }
          : { code: null, studentName: studentName || null, deviceInfo };

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
                onClick={() => {
                  const now = new Date().toISOString();
                  submitClicksRef.current.count += 1;
                  submitClicksRef.current.timestamps.push(now);
                }}
                disabled={
                  loading ||
                  (examInfo.access_type === "code_based" && !isValidCode(code)) ||
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
