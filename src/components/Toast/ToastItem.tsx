import { ToastItemProps } from "./types";

export default function ToastItem({ toast, onDismiss }: ToastItemProps) {
  return (
    <div className={`toast ${toast.kind ?? "default"}`} role="status">
      {toast.title && <div className="toast-title">{toast.title}</div>}
      <div className="toast-message">{toast.message}</div>
      <button 
        className="toast-close" 
        onClick={() => onDismiss(toast.id)} 
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}