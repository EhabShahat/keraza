import { SingleChoiceInputProps } from "../types";
import { hasArabic } from "../utils";

export default function SingleChoiceInput({
  options,
  value,
  onChange,
  disabled,
  required,
  id,
  legendId,
  optionImageUrls
}: SingleChoiceInputProps) {
  return (
    <div className="space-y-3" role="radiogroup" aria-labelledby={legendId}>
      {options.map((opt, idx) => {
        const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D...
        const isSelected = value === opt;
        const imgUrl = optionImageUrls?.[idx] || null;
        return (
          <label key={idx} className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
            isSelected ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--muted)]/50'
          }`}>
            <input
              type="radio"
              name={id}
              disabled={disabled}
              required={required}
              checked={isSelected}
              onChange={() => onChange(opt)}
              className="w-4 h-4 text-blue-600 mt-1"
            />
            <div className="flex items-start gap-3 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                isSelected ? 'bg-blue-600 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
              }`}>
                {optionLetter}
              </div>
              <div className="flex-1 space-y-2">
                {imgUrl && (
                  <img
                    src={imgUrl}
                    alt={`Option ${optionLetter}`}
                    className="max-h-40 w-auto object-contain rounded border"
                    draggable={false}
                  />
                )}
              <span 
                className={`flex-1 leading-relaxed select-none ${hasArabic(opt) ? 'arabic-text' : ''}`}
                dir={hasArabic(opt) ? 'rtl' : 'ltr'}
              >
                {opt}
              </span>
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}