/**
 * Clamps a value between min and max
 */
export function clampValue(value: number, min: number = 0, max: number = 100): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}