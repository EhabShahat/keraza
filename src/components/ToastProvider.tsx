"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastKind = "default" | "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  kind?: ToastKind;
  duration?: number; // ms
}

interface ToastContextValue {
  show: (msg: string | Partial<ToastItem>) => void;
  success: (msg: string | Partial<ToastItem>) => void;
  error: (msg: string | Partial<ToastItem>) => void;
  info: (msg: string | Partial<ToastItem>) => void;
  warning: (msg: string | Partial<ToastItem>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function useToastInternal(): ToastContextValue {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, any>>({});

  const dismiss = useCallback((id: string) => {
    setItems((arr) => arr.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback((raw: string | Partial<ToastItem>, kind: ToastKind = "default") => {
    const item: ToastItem = {
      id: Math.random().toString(36).slice(2),
      message: typeof raw === "string" ? raw : raw.message || "",
      title: typeof raw === "string" ? undefined : raw.title,
      kind: typeof raw === "string" ? kind : raw.kind || kind,
      duration: typeof raw === "string" ? 3500 : raw.duration ?? 3500,
    };
    setItems((arr) => [...arr, item]);
    if (item.duration && item.duration > 0) {
      timers.current[item.id] = setTimeout(() => dismiss(item.id), item.duration);
    }
  }, [dismiss]);

  const api: ToastContextValue = useMemo(() => ({
    show: (m) => push(m, "default"),
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
    warning: (m) => push(m, "warning"),
  }), [push]);

  return api as ToastContextValue & { items: ToastItem[]; dismiss: (id: string) => void } as any;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const api = useToastInternal() as any;
  const items: ToastItem[] = api.items ?? [];

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind ?? "default"}`} role="status">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-message">{t.message}</div>
            <button className="toast-close" onClick={() => api.dismiss(t.id)} aria-label="Close">×</button>
          </div>
        ))}
      </div>
      <style jsx global>{`
        .toast-container { position: fixed; top: 1rem; right: 1rem; display: grid; gap: .5rem; z-index: 1000; }
        .toast { position: relative; min-width: 220px; max-width: 360px; padding: .625rem .875rem; border-radius: 10px; border: 1px solid var(--border); background: var(--card); box-shadow: 0 10px 20px rgba(0,0,0,.06); }
        .toast .toast-title { font-weight: 700; margin-bottom: .125rem; }
        .toast .toast-message { font-size: .9rem; }
        .toast .toast-close { position: absolute; top: 6px; right: 8px; border: none; background: transparent; cursor: pointer; color: var(--muted-foreground); font-size: 1rem; }
        .toast.success { border-color: color-mix(in srgb, var(--accent) 50%, white 50%); background: color-mix(in srgb, var(--accent) 10%, white 90%); }
        .toast.error { border-color: color-mix(in srgb, var(--destructive) 50%, white 50%); background: color-mix(in srgb, var(--destructive) 10%, white 90%); }
        .toast.info { border-color: color-mix(in srgb, var(--primary) 50%, white 50%); background: color-mix(in srgb, var(--primary) 10%, white 90%); }
        .toast.warning { border-color: color-mix(in srgb, orange 50%, white 50%); background: color-mix(in srgb, orange 10%, white 90%); }
      `}</style>
    </ToastContext.Provider>
  );
}
