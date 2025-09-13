import { TrueFalseInputProps } from "../types";

export default function TrueFalseInput({
  value,
  onChange,
  disabled,
  required,
  id,
  legendId
}: TrueFalseInputProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby={legendId}>
      <label className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
        value === true ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--muted)]/50'
      }`}>
        <input
          type="radio"
          name={id}
          disabled={disabled}
          required={required}
          checked={value === true}
          onChange={() => onChange(true)}
          className="w-4 h-4 text-blue-600"
        />
        <span className="font-medium">True</span>
      </label>
      <label className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
        value === false ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--muted)]/50'
      }`}>
        <input
          type="radio"
          name={id}
          disabled={disabled}
          required={required}
          checked={value === false}
          onChange={() => onChange(false)}
          className="w-4 h-4 text-blue-600"
        />
        <span className="font-medium">False</span>
      </label>
    </div>
  );
}