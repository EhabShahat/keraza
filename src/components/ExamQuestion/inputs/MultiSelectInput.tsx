import { MultiSelectInputProps } from "../types";
import { hasArabic } from "../utils";

export default function MultiSelectInput({
  options,
  value,
  onChange,
  disabled,
  required,
  id,
  legendId
}: MultiSelectInputProps) {
  return (
    <div className="space-y-3" role="group" aria-labelledby={legendId}>
      <p className="text-sm text-[var(--muted-foreground)] mb-3">
        Select all that apply ({value.length} selected)
      </p>
      {options.map((opt, idx) => {
        const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D...
        const isSelected = value.includes(opt);
        return (
          <label key={idx} className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
            isSelected ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--muted)]/50'
          }`}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={isSelected}
              onChange={(e) => {
                const newValue = e.target.checked ? [...value, opt] : value.filter((x) => x !== opt);
                onChange(newValue);
              }}
              className="w-4 h-4 text-blue-600 mt-1"
            />
            <div className="flex items-start gap-3 flex-1">
              <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${
                isSelected ? 'bg-blue-600 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
              }`}>
                {optionLetter}
              </div>
              <span 
                className={`flex-1 leading-relaxed select-none ${hasArabic(opt) ? 'arabic-text' : ''}`}
                dir={hasArabic(opt) ? 'rtl' : 'ltr'}
              >
                {opt}
              </span>
            </div>
          </label>
        );
      })}
    </div>
  );
}