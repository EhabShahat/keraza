import { useEffect, useMemo, useRef, useState } from "react";
import { UseTimerProps, UseTimerResult } from "../types";

export function useTimer({
  startedAt,
  durationMinutes,
  examEndsAt,
  onExpire,
  disabled
}: UseTimerProps): UseTimerResult {
  const [now, setNow] = useState<number>(Date.now());
  const firedRef = useRef(false);

  const deadline = useMemo(() => {
    const deadlines: number[] = [];
    if (durationMinutes && durationMinutes > 0) {
      deadlines.push(new Date(startedAt).getTime() + durationMinutes * 60_000);
    }
    if (examEndsAt) {
      deadlines.push(new Date(examEndsAt).getTime());
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
    if (!deadline || disabled) return;
    if (remainingMs === 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire();
    }
  }, [remainingMs, deadline, disabled, onExpire]);

  return { remainingMs, deadline };
}