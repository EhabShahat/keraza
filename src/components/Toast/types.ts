export type ToastKind = "default" | "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  kind?: ToastKind;
  duration?: number; // ms
}

export interface ToastContextValue {
  show: (msg: string | Partial<ToastItem>) => void;
  success: (msg: string | Partial<ToastItem>) => void;
  error: (msg: string | Partial<ToastItem>) => void;
  info: (msg: string | Partial<ToastItem>) => void;
  warning: (msg: string | Partial<ToastItem>) => void;
}

export interface ToastItemProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}