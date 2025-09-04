"use client";

import React from "react";
import { ToastContext } from "./ToastContext";
import { useToastInternal } from "./hooks/useToastInternal";
import ToastItem from "./ToastItem";
import ToastStyles from "./ToastStyles";

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const { api, items, dismiss } = useToastInternal();

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {items.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
      <ToastStyles />
    </ToastContext.Provider>
  );
}

export { useToast } from "./ToastContext";
export type { ToastItem, ToastKind, ToastContextValue } from "./types";