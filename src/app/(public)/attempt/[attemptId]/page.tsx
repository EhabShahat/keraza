"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExamQuestion, { type AnswerValue } from "@/components/ExamQuestion";
import type { AttemptState, Question } from "@/lib/types";
import ProgressBar from "@/components/ProgressBar";
import Timer from "@/components/Timer";
import { shuffle } from "@/lib/randomization";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";
import { useParams } from "next/navigation";

// Note: Storage clearing is now handled automatically by the global StorageCleaner component
// This ensures students get a completely fresh experience every time they access any page

// Add CSS to prevent text selection
const noCopyStyle = `
  .no-copy {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }
`;

// Helper functions
function isQuestionAnswered(question: Question, answer: AnswerValue): boolean {
  if (answer === null || answer === undefined) return false;
  
  switch (question.question_type) {
    case "multiple_choice":
    case "single_choice":
      return typeof answer === "string" && answer.trim() !== "";
    case "true_false":
      return typeof answer === "boolean"; // Fix: true/false answers are boolean, not string
    case "multi_select":
      return Array.isArray(answer) && answer.length > 0;
    case "short_answer":
    case "paragraph":
      return typeof answer === "string" && answer.trim() !== "";
    default:
      return false;
  }
}

function countAnswered(answers: Record<string, AnswerValue>, questions: Question[]): number {
  return questions.filter(q => isQuestionAnswered(q, answers[q.id])).length;
}

export default function AttemptPage() {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<AttemptState | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [version, setVersion] = useState<number>(1);
  const saveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const answersRef = useRef<Record<string, AnswerValue>>({});
  const versionRef = useRef<number>(1);

  // Keep refs in sync to avoid stale closures during saves
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { versionRef.current = version; }, [version]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeWarning, setTimeWarning] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(200); // Dynamic header height
  const { locale, dir } = useStudentLocale();
  const mainRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const routeParams = useParams();
  // Resolve attemptId from router params with legacy fallback for older browsers
  useEffect(() => {
    let id: string | null = null;
    try {
      const v: any = (routeParams as any)?.attemptId;
      id = typeof v === "string" ? v : Array.isArray(v) ? v[0] : null;
    } catch {}
    if (!id) {
      try {
        const m = window.location.pathname.match(/\/attempt\/([^\/?#]+)/);
        if (m) id = decodeURIComponent(m[1]);
      } catch {}
    }
    setAttemptId(id);
  }, [routeParams]);

  const total = state?.questions.length ?? 0;
  const answered = useMemo(() => countAnswered(answers, state?.questions || []), [answers, state?.questions]);
  const autoSaveIntervalSec = useMemo(() => {
    const s = state?.exam?.settings as any;
    return Number(s?.auto_save_interval ?? 10);
  }, [state?.exam?.settings]);
  const storageKey = useMemo(() => `attempt:${attemptId}:draft`, [attemptId]);
  const displayMode = useMemo(() => {
    const s = state?.exam?.settings as any;
    return String(s?.display_mode ?? "full");
  }, [state?.exam?.settings]);
  const randomize = useMemo(() => {
    const s = state?.exam?.settings as any;
    return Boolean(s?.randomize_questions);
  }, [state?.exam?.settings]);
  const questions = useMemo(() => {
    if (!state) return [] as Question[];
    let qs = state.questions.slice();
    if (randomize && attemptId) qs = shuffle(qs, attemptId);
    // Shuffle options per question deterministically
    qs = qs.map((q) => {
      const opts = (q.options as string[] | null) ?? null;
      if (!opts || opts.length === 0) return q;
      const shuffled = attemptId ? shuffle(opts, `${attemptId}:${q.id}`) : opts;
      return { ...q, options: shuffled } as Question;
    });
    return qs;
  }, [state, randomize, attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/attempts/${attemptId}/state`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load state");
        if (cancelled) return;
        setState(data as AttemptState);
        setAnswers((data?.answers as any) || {});
        setVersion((data?.version as number) || 1);
        // Try recovery from localStorage
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const draft = JSON.parse(raw) as { answers?: Record<string, AnswerValue>; ts?: number };
            if (draft?.answers && Object.keys(draft.answers).length > 0) {
              setAnswers((prev) => ({ ...draft.answers, ...prev }));
            }
          }
        } catch {}
      } catch (e: any) {
        setError(e?.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId, storageKey]);

  useEffect(() => {
    if (!state) return;
    if (saveTimer.current) clearInterval(saveTimer.current);
    saveTimer.current = setInterval(() => {
      void saveNow();
    }, Math.max(5, autoSaveIntervalSec) * 1000);
    return () => {
      if (saveTimer.current) clearInterval(saveTimer.current);
    };
    // Only depend on state and interval seconds to avoid thrashing on every keystroke
  }, [state, autoSaveIntervalSec]);

  function scheduleSave(delay = 800) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { void saveNow(); }, delay);
  }

  async function saveNow() {
    if (!state) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    setSaveStatus("saving");
    inFlightRef.current = true;
    try {
      let retry = 0;
      // Attempt up to 2 times if version conflict occurs
      while (retry < 2) {
        const payloadAnswers = answersRef.current;
        const expectedVersion = versionRef.current;
        const res = await fetch(`/api/attempts/${attemptId}/save`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: payloadAnswers,
            auto_save_data: { progress: { answered, total } },
            expected_version: expectedVersion,
          }),
        });
        if (res.status === 409) {
          const payload = await res.json();
          const latest = payload?.latest as AttemptState | undefined;
          if (latest?.version) {
            // Update version only; keep local answers to avoid clearing in UI
            setVersion(latest.version);
            versionRef.current = latest.version;
          }
          retry++;
          continue;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Save failed");
        if (data?.new_version) {
          setVersion(data.new_version);
          versionRef.current = data.new_version;
        }
        setSaveStatus("saved");
        setLastSavedAt(Date.now());
        break;
      }
    } catch {
      // ignore transient errors; next tick/interval will retry
      setSaveStatus("error");
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void saveNow();
      }
    }
  }

  async function onSubmit() {
    if (!state || !attemptId) return;
    
    // Prevent double submission with more robust checks
    if (submitting || state.completion_status === "submitted") {
      console.log("Submission already in progress or completed");
      return;
    }
    
    // Check if we're already on thank you page (prevent loops)
    if (window.location.pathname.includes('/thank-you/')) {
      console.log("Already on thank you page, skipping submission");
      return;
    }
    
    console.log("Starting exam submission for attempt:", attemptId);
    
    try {
      setSubmitting(true);
      
      // Save current state first
      await saveNow();
      
      const res = await fetch(`/api/attempts/${attemptId}/submit`, { 
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data?.error || "Submit failed");
      
      // Update state to prevent further submissions
      setState((prev) => prev ? { ...prev, completion_status: "submitted", submitted_at: new Date().toISOString() } : prev);
      
      console.log("Exam submitted successfully, redirecting to thank you page");
      
      // Use a more reliable redirect method for old browsers
      const thankYouUrl = `/thank-you/${attemptId}`;
      
      // Add a small delay to ensure state is updated
      setTimeout(() => {
        try {
          // Try the most compatible method first
          if (typeof window.location.replace === 'function') {
            window.location.replace(thankYouUrl);
          } else if (typeof window.location.assign === 'function') {
            window.location.assign(thankYouUrl);
          } else {
            window.location.href = thankYouUrl;
          }
        } catch (error) {
          console.error("Redirect error:", error);
          // Last resort - manual navigation
          window.location = thankYouUrl as any;
        }
      }, 500);
      
    } catch (e: any) {
      console.error("Submission error:", e);
      setError(e?.message || "Submit error");
      setSubmitting(false);
    }
  }

  function onAnswerChange(q: Question, val: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [q.id]: val }));
    scheduleSave(800);
  }

  // Persist to localStorage for recovery/offline support
  useEffect(() => {
    try {
      const payload = { answers, ts: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {}
  }, [answers, storageKey]);

  // Online/offline handling
  useEffect(() => {
    const set = () => setIsOnline(navigator.onLine);
    set();
    const onOnline = () => { set(); void saveNow(); };
    const onOffline = () => set();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, version, answered, total]);

  // Keyboard navigation for per-question mode
  useEffect(() => {
    if (displayMode !== "per_question") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [displayMode, questions.length]);

  // Auto-collapse sidebar on mobile, expand on desktop
  useEffect(() => {
    try {
      const mq = window.matchMedia("(min-width: 768px)");
      setSidebarCollapsed(!mq.matches);
      const handler = (e: MediaQueryListEvent) => setSidebarCollapsed(!e.matches);
      if ("addEventListener" in mq) {
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
      } else if ("addListener" in mq) {
        (mq as any).addListener(handler);
        return () => (mq as any).removeListener(handler);
      }
    } catch {}
  }, []);

  // Calculate header height dynamically
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        setHeaderHeight(height);
      }
    };

    // Update on mount and resize
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    
    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(updateHeaderHeight, 100);
    
    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      clearTimeout(timer);
    };
  }, [state, answered, total]); // Re-calculate when content changes

  // Cleanup highlight timer
  useEffect(() => {
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, []);

  function handleJumpTo(idx: number) {
    setCurrentIdx(idx);
    if (displayMode === "per_question") return;
    const q = questions[idx];
    if (!q) return;
    const el = questionRefs.current[q.id];
    if (el) {
      try { el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" }); } catch { try { (el as any).scrollIntoView(true); } catch {} }
      setFlashId(q.id);
      try { (el as any)?.focus?.({ preventScroll: true }); } catch {}
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashId(null), 800);
    }
  }

  function handleTimeWarning(minutesLeft: number) {
    let message = "";
    if (minutesLeft === 60) {
      message = t(locale, 'one_hour_remaining');
    } else if (minutesLeft === 30) {
      message = t(locale, 'thirty_minutes_remaining');
    } else if (minutesLeft === 15) {
      message = t(locale, 'fifteen_minutes_remaining');
    } else if (minutesLeft === 5) {
      message = t(locale, 'five_minutes_remaining');
    } else if (minutesLeft === 1) {
      message = t(locale, 'one_minute_remaining');
    }
    
    if (message) {
      setTimeWarning(message);
      // Auto-hide warning after 10 seconds
      setTimeout(() => setTimeWarning(null), 10000);
    }
  }

  if (!attemptId || loading) {
    return (
      <div dir={dir} lang={locale} className="loading-container mobile-safe">
        <div className="text-center" style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: '#6b7280', fontSize: '16px', margin: 0, fontFamily: 'Arial, sans-serif' }}>{t(locale, 'loading_exam')}</p>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '0.5rem', fontFamily: 'Arial, sans-serif' }}>{t(locale, 'loading_exam_hint')}</p>
          
          {/* Fallback for very slow connections */}
          <div style={{ marginTop: '2rem' }}>
            <button 
              onClick={() => window.location.reload()} 
              className="btn btn-outline"
              style={{ fontSize: '14px', padding: '0.5rem 1rem' }}
            >
              {t(locale, 'try_again')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div dir={dir} lang={locale} style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '1rem',
        width: '100%'
      }}>
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            margin: '0 auto 1.5rem auto', 
            backgroundColor: '#fecaca', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f172a', marginBottom: '1rem' }}>
            {t(locale, 'unable_load_exam')}
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5' }}>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary"
            style={{ fontSize: '16px', padding: '0.75rem 1.5rem' }}
          >
            {t(locale, 'try_again')}
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div dir={dir} lang={locale} style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '1rem',
        width: '100%'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>{t(locale, 'no_attempt_found')}</p>
        </div>
      </div>
    );
  }

  const disabled = state.completion_status === "submitted";
  const progressPercentage = total ? Math.round((answered / total) * 100) : 0;
  const unansweredCount = Math.max(0, total - answered);

  return (
    <div dir={dir} lang={locale} style={{ 
      minHeight: '100vh', 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      margin: 0,
      padding: 0
    }}>
      {/* Add style tag for no-copy functionality */}
      <style dangerouslySetInnerHTML={{ __html: noCopyStyle }} />
      
      {/* Header - Fixed to Screen */}
      <header 
        ref={headerRef}
        style={{ 
          backgroundColor: 'var(--card)', 
          borderBottom: '1px solid var(--border)', 
          position: 'fixed', 
          top: 0, 
          left: 0,
          right: 0,
          zIndex: 50,
          width: '100%',
          padding: '1rem'
        }}>
        {/* Title */}
        <h1 style={{ 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          color: 'var(--foreground)',
          margin: '0 0 0.5rem 0'
        }}>
          {state.exam.title}
        </h1>

        {/* Meta Info */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '1rem', 
          alignItems: 'center',
          fontSize: '0.875rem',
          color: 'var(--muted-foreground)',
          marginBottom: '1rem'
        }}>
          <span>{t(locale, 'question_of_total', { current: currentIdx + 1, total })}</span>
          <span>•</span>
          <span>{t(locale, 'x_answered', { count: answered })}</span>
          {!isOnline && (
            <>
              <span>•</span>
              <span style={{ color: '#ea580c', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18m-9-9v18"/>
                </svg>
                {t(locale, 'offline')}
              </span>
            </>
          )}
        </div>

        {/* Timer and Save Status */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <Timer 
            startedAt={state.started_at} 
            durationMinutes={state.exam.duration_minutes} 
            examEndsAt={state.exam.end_time} 
            onExpire={onSubmit} 
            onWarning={handleTimeWarning}
            disabled={disabled}
          />

          {/* Save Status */}
          <div style={{ fontSize: '0.875rem' }}>
            {saveStatus === "saving" && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px'
              }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  border: '2px solid #bfdbfe', 
                  borderTop: '2px solid #2563eb', 
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                {t(locale, 'auto_syncing')}
              </div>
            )}
            {saveStatus === "saved" && lastSavedAt && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                color: '#16a34a',
                backgroundColor: '#f0fdf4',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {t(locale, 'auto_saved')}
              </div>
            )}
            {saveStatus === "error" && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                color: '#dc2626',
                backgroundColor: '#fef2f2',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                {t(locale, 'sync_failed')}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{t(locale, 'progress')}</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{progressPercentage}%</span>
          </div>
          <div style={{ 
            width: '100%', 
            backgroundColor: 'var(--muted)', 
            borderRadius: '9999px', 
            height: '8px'
          }}>
            <div 
              style={{ 
                backgroundColor: '#2563eb', 
                height: '8px', 
                borderRadius: '9999px',
                width: `${progressPercentage}%`,
                transition: 'width 0.3s ease'
              }}
            ></div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Full Width Layout with Fixed Header Offset */}
      <div style={{ 
        display: 'flex', 
        flex: 1,
        width: '100%',
        overflow: 'hidden',
        marginTop: `${headerHeight}px` // Dynamic offset for fixed header
      }}>
        {/* Sidebar - Fixed to Screen */}
        <aside style={{
          backgroundColor: 'var(--card)',
          borderRight: '1px solid var(--border)',
          width: sidebarCollapsed ? '48px' : '200px',
          minWidth: sidebarCollapsed ? '48px' : '200px',
          height: `calc(100vh - ${headerHeight}px)`,
          position: 'fixed',
          left: 0,
          top: `${headerHeight}px`, // Below fixed header
          zIndex: 40,
          overflow: 'auto',
          padding: '0.5rem'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            {!sidebarCollapsed && (
              <h2 style={{ 
                fontSize: '0.875rem', 
                fontWeight: '600',
                margin: 0
              }}>
                {t(locale, 'questions')}
              </h2>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                padding: '0.25rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label={sidebarCollapsed ? t(locale, 'expand_sidebar') : t(locale, 'collapse_sidebar')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={sidebarCollapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"}/>
              </svg>
            </button>
          </div>

          {/* Question Navigation */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.25rem'
          }}>
            {questions.map((q, idx) => {
              const isAnswered = isQuestionAnswered(q, answers[q.id]);
              const isCurrent = idx === currentIdx;
              
              return (
                <button
                  key={q.id}
                  onClick={() => handleJumpTo(idx)}
                  style={{
                    width: '100%',
                    height: sidebarCollapsed ? '32px' : '36px',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    backgroundColor: isCurrent 
                      ? 'var(--primary)' 
                      : isAnswered
                      ? '#16a34a'
                      : 'var(--background)',
                    color: isCurrent || isAnswered ? 'white' : 'var(--foreground)',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  title={`${t(locale, 'question_n', { n: idx + 1 })}${isAnswered ? ' ' + t(locale, 'answered_paren') : ''}`}
                >
                  {sidebarCollapsed ? idx + 1 : `${t(locale, 'question_n', { n: idx + 1 })}`}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content - Full Width with Fixed Sidebar Offset */}
        <main 
          ref={mainRef} 
          className="no-copy" 
          style={{ 
            flex: 1,
            padding: '1rem',
            overflow: 'auto',
            width: `calc(100% - ${sidebarCollapsed ? '48px' : '200px'})`, // Full width minus sidebar
            marginLeft: sidebarCollapsed ? '48px' : '200px', // Offset for fixed sidebar
            height: `calc(100vh - ${headerHeight}px)`, // Full height minus header
            position: 'relative'
          }}
          onCopy={(e) => e.preventDefault()} 
          onCut={(e) => e.preventDefault()}
        >
          {displayMode === "per_question" ? (
            <div style={{ width: '100%' }}>
              {/* Current Question */}
              {questions[currentIdx] && (
                <div style={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  width: '100%'
                }}>
                  <ExamQuestion
                    key={questions[currentIdx].id}
                    q={questions[currentIdx]}
                    value={answers[questions[currentIdx].id] as AnswerValue}
                    onChange={(v) => onAnswerChange(questions[currentIdx], v)}
                    onSave={saveNow}
                    disabled={disabled}
                  />
                </div>
              )}

              {/* Navigation */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                width: '100%'
              }}>
                <button 
                  className="btn btn-outline"
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} 
                  disabled={currentIdx === 0}
                  style={{ minWidth: '100px' }}
                >
                  <span style={{ marginRight: '0.25rem' }}>←</span> {t(locale, 'previous')}
                </button>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => saveNow()}
                    disabled={disabled}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.25rem' }}>
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17,21 17,13 7,13 7,21"/>
                      <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    {t(locale, 'save')}
                  </button>

                  {currentIdx === questions.length - 1 ? (
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowSubmitConfirm(true)}
                      disabled={disabled || submitting}
                    >
                      {submitting ? (
                        <>
                          <div style={{ 
                            width: '16px', 
                            height: '16px', 
                            border: '2px solid white', 
                            borderTop: '2px solid transparent', 
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            marginRight: '0.5rem'
                          }}></div>
                          {t(locale, 'submitting')}
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.25rem' }}>
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                          {t(locale, 'submit_exam')}
                        </>
                      )}
                    </button>
                  ) : (
                    <button 
                      className="btn btn-primary"
                      onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))} 
                      disabled={currentIdx >= questions.length - 1}
                      style={{ minWidth: '100px' }}
                    >
                      {t(locale, 'next')} <span style={{ marginLeft: '0.25rem' }}>→</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Full View Mode */
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    ref={(el) => { questionRefs.current[q.id] = el; }}
                    style={{
                      backgroundColor: 'var(--card)',
                      border: flashId === q.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      padding: '1.5rem',
                      width: '100%',
                      transition: 'border-color 0.3s ease'
                    }}
                  >
                    <ExamQuestion
                      q={q}
                      value={answers[q.id] as AnswerValue}
                      onChange={(v) => onAnswerChange(q, v)}
                      onSave={saveNow}
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <div style={{ 
                marginTop: '2rem', 
                display: 'flex', 
                justifyContent: 'center',
                width: '100%'
              }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={disabled || submitting}
                  style={{ minWidth: '200px' }}
                >
                  {submitting ? (
                    <>
                      <div style={{ 
                        width: '16px', 
                        height: '16px', 
                        border: '2px solid white', 
                        borderTop: '2px solid transparent', 
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginRight: '0.5rem'
                      }}></div>
                      {t(locale, 'submitting')}
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      {t(locale, 'submit_exam')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submitConfirmTitle"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !submitting) setShowSubmitConfirm(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setShowSubmitConfirm(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem'
          }}
        >
          <div style={{
            backgroundColor: 'var(--card)',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            maxWidth: '460px',
            width: '100%',
            border: '1px solid var(--border)',
            textAlign: 'center'
          }}>
            <h3 id="submitConfirmTitle" style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              margin: '0 0 1rem 0'
            }}>
              {t(locale, 'submit_exam_q')}
            </h3>

            {/* Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginBottom: '1rem',
              textAlign: 'center',
              justifyItems: 'center'
            }}>
              <div style={{
                backgroundColor: 'var(--muted)',
                padding: '0.75rem',
                borderRadius: '0.375rem'
              }}>
                <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>{t(locale, 'total_questions')}</div>
                <div style={{ fontWeight: 600 }}>{total}</div>
              </div>
              <div style={{
                backgroundColor: '#f0fdf4',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #dcfce7'
              }}>
                <div style={{ color: '#16a34a', fontSize: '0.75rem' }}>{t(locale, 'answered_label')}</div>
                <div style={{ fontWeight: 600, color: '#166534' }}>{answered}</div>
              </div>
              <div style={{
                backgroundColor: '#fef2f2',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #fee2e2'
              }}>
                <div style={{ color: '#dc2626', fontSize: '0.75rem' }}>{t(locale, 'unanswered_label')}</div>
                <div style={{ fontWeight: 600, color: '#991b1b' }}>{unansweredCount}</div>
              </div>
              <div style={{
                backgroundColor: 'var(--muted)',
                padding: '0.75rem',
                borderRadius: '0.375rem'
              }}>
                <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>{t(locale, 'progress_label')}</div>
                <div style={{ fontWeight: 600 }}>{progressPercentage}%</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ height: '8px', background: 'var(--muted)', borderRadius: '9999px' }}>
                <div style={{ height: '8px', width: `${progressPercentage}%`, background: '#2563eb', borderRadius: '9999px', transition: 'width 0.2s ease' }} />
              </div>
            </div>

            {/* Warning */}
            <div style={{ 
              backgroundColor: '#fff7ed',
              border: '1px solid #ffedd5',
              color: '#9a3412',
              borderRadius: '0.375rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{t(locale, 'warning')}</div>
              <div style={{ lineHeight: 1.5 }}>
                <div>{t(locale, 'cannot_be_undone')}</div>
                {unansweredCount > 0 && (
                  <div>{t(locale, 'unanswered_warning', { count: unansweredCount })}</div>
                )}
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              justifyContent: 'center'
            }}>
              <button 
                className="btn btn-outline"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
              >
                {t(locale, 'cancel')}
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowSubmitConfirm(false);
                  onSubmit();
                }}
                disabled={submitting}
              >
                {t(locale, 'confirm_submit_exam')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Warning Modal */}
      {timeWarning && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          zIndex: 60,
          maxWidth: '400px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            color: '#d97706'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600',
              margin: 0,
              color: '#d97706'
            }}>
              {t(locale, 'time_warning')}
            </h3>
          </div>
          <p style={{ 
            color: '#92400e', 
            marginBottom: '1rem',
            fontSize: '1rem',
            margin: '0 0 1rem 0'
          }}>
            {timeWarning}
          </p>
          <button 
            onClick={() => setTimeWarning(null)}
            style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {t(locale, 'understood')}
          </button>
        </div>
      )}

      {/* Add CSS animation for spinner */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  );
}