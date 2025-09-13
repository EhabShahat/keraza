"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function Timer({
  startedAt,
  durationMinutes,
  examEndsAt,
  onExpire,
  onWarning,
  disabled,
}: {
  startedAt: string;
  durationMinutes: number | null;
  examEndsAt: string | null;
  onExpire: () => void;
  onWarning?: (minutesLeft: number) => void;
  disabled?: boolean;
}) {
  const [now, setNow] = useState<number>(Date.now());
  const firedRef = useRef(false);
  const warningsFiredRef = useRef<Set<number>>(new Set());

  const deadline = useMemo(() => {
    const deadlines: number[] = [];
    
    try {
      if (durationMinutes && durationMinutes > 0) {
        const startTime = new Date(startedAt).getTime();
        // Check if date parsing was successful
        if (!isNaN(startTime)) {
          deadlines.push(startTime + durationMinutes * 60_000);
        }
      }
      
      if (examEndsAt) {
        const endTime = new Date(examEndsAt).getTime();
        // Check if date parsing was successful
        if (!isNaN(endTime)) {
          deadlines.push(endTime);
        }
      }
    } catch (error) {
      console.warn("Timer: Error parsing dates", error);
      return null;
    }
    
    if (deadlines.length === 0) return null;
    return Math.min(...deadlines);
  }, [startedAt, durationMinutes, examEndsAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = deadline ? Math.max(0, deadline - now) : null;

  useEffect(() => {
    if (!deadline || disabled || firedRef.current) return;
    
    // Add safety check - only fire if we're really at 0 and have been running for at least 30 seconds
    const startTime = new Date(startedAt).getTime();
    const hasBeenRunning = (Date.now() - startTime) > 30000; // 30 seconds minimum
    const isReallyExpired = remainingMs === 0 && Date.now() >= deadline;
    
    if (isReallyExpired && hasBeenRunning) {
      console.log("Timer expired, submitting exam");
      firedRef.current = true;
      // Add a small delay to prevent race conditions
      setTimeout(() => {
        onExpire();
      }, 1000);
    }
    
    // Fire warnings at specific intervals
    if (onWarning && remainingMs !== null && remainingMs > 0) {
      const minutesLeft = Math.floor(remainingMs / 60000);
      const warningThresholds = [60, 30, 15, 5, 1]; // 1 hour, 30 min, 15 min, 5 min, 1 min
      
      for (const threshold of warningThresholds) {
        if (minutesLeft === threshold && !warningsFiredRef.current.has(threshold)) {
          warningsFiredRef.current.add(threshold);
          onWarning(threshold);
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, deadline, disabled, startedAt, onWarning]);

  if (!deadline) return null;

  const text = formatDuration(remainingMs ?? 0);
  const minutesLeft = Math.floor((remainingMs ?? 0) / 60000);
  const low = (remainingMs ?? 0) <= 60_000; // Last minute
  const warning = minutesLeft <= 60 && minutesLeft > 1; // Less than 1 hour but more than 1 minute

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-medium ${
        low 
          ? "bg-red-100 text-red-700 border border-red-200" 
          : warning
          ? "bg-orange-100 text-orange-700 border border-orange-200"
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

export function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
