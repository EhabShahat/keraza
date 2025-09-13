import { clsx } from "clsx";
import { ParagraphInputProps } from "../types";

export default function ParagraphInput({
  value,
  onChange,
  disabled,
  required,
  legendId
}: ParagraphInputProps) {
  return (
    <div className="space-y-2">
      <textarea
        className={clsx(
          "w-full border border-[var(--border)] rounded-lg p-4 text-[var(--foreground)] bg-[var(--input)] resize-none transition-all",
          "focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20 focus:outline-none",
          disabled && "opacity-70 cursor-not-allowed"
        )}
        rows={6}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-labelledby={legendId}
        aria-required={required || undefined}
        placeholder="Type your answer here..."
      />
      <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
        <span>Be as detailed as possible</span>
        <span>{value.length} characters</span>
      </div>
    </div>
  );
}