import { formatDuration } from "./utils";

interface TimerDisplayProps {
  remainingMs: number;
  isLow: boolean;
}

export default function TimerDisplay({ remainingMs, isLow }: TimerDisplayProps) {
  const text = formatDuration(remainingMs);
  
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-medium ${
        isLow 
          ? "bg-red-100 text-red-700 border border-red-200" 
          : "bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]"
      }`}
      role="timer"
      aria-live="polite"
      aria-label="Time remaining"
      aria-atomic="true"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
      {text}
    </div>
  );
}