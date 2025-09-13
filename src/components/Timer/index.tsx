import { TimerProps } from './types';
import { useTimer } from './hooks/useTimer';
import TimerDisplay from './TimerDisplay';

export default function Timer({
  startedAt,
  durationMinutes,
  examEndsAt,
  onExpire,
  disabled = false
}: TimerProps) {
  const { remainingMs } = useTimer({
    startedAt,
    durationMinutes,
    examEndsAt,
    onExpire,
    disabled
  });

  // If there's no deadline or timer is disabled, don't render anything
  if (remainingMs === null || disabled) {
    return null;
  }

  // Determine if time is running low (less than 5 minutes)
  const isLow = remainingMs < 5 * 60 * 1000;

  return <TimerDisplay remainingMs={remainingMs} isLow={isLow} />;
}

// Export types and utilities for external use
export * from './types';
export * from './utils';
export { useTimer } from './hooks/useTimer';