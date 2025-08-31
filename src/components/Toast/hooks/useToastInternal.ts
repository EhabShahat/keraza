import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContextValue, ToastItem, ToastKind } from "../types";

export function useToastInternal() {
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

  return { api, items, dismiss };
}