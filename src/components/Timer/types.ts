export interface TimerProps {
  startedAt: string;
  durationMinutes: number | null;
  examEndsAt: string | null;
  onExpire: () => void;
  disabled?: boolean;
}

export interface UseTimerProps {
  startedAt: string;
  durationMinutes: number | null;
  examEndsAt: string | null;
  onExpire: () => void;
  disabled?: boolean;
}

export interface UseTimerResult {
  remainingMs: number | null;
  deadline: number | null;
}