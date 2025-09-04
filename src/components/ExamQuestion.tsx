"use client";

import React, { useId } from "react";
import { clsx } from "clsx";
import type { Question, QuestionType } from "@/lib/types";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t as translate } from "@/i18n/student";

export type AnswerValue = string | boolean | string[] | null;

export default function ExamQuestion({
  q,
  value,
  onChange,
  disabled,
  onSave,
}: {
  q: Question;
  value: AnswerValue;
  onChange: (val: AnswerValue) => void;
  disabled?: boolean;
  onSave?: () => void;
}) {
  const id = useId();
  const qType = q.question_type as QuestionType;
  const legendId = `${id}-legend`;
  const { locale } = useStudentLocale();
  
  // Detect if text contains Arabic characters
  const hasArabic = (text: string) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  const questionHasArabic = hasArabic(q.question_text);
  
  // Handle answer change with auto-save
  const handleChange = (newValue: AnswerValue) => {
    // Only propagate the change; parent handles debounced/queued saving
    onChange(newValue);
  };
  
  // Clear answer function
  const clearAnswer = () => {
    // Only clear locally; parent handles saving
    onChange(null);
  };
  
  // Check if question is answered
  const isAnswered = () => {
    if (qType === "paragraph") {
      return typeof value === "string" && value.trim().length > 0;
    } else if (qType === "true_false") {
      return typeof value === "boolean";
    } else if (Array.isArray(value)) {
      return value.length > 0;
    } else if (typeof value === "string") {
      return value.length > 0;
    }
    return false;
  };

  return (
    <div 
      className="space-y-4" 
      aria-required={q.required || undefined}
      onCopy={(e) => e.preventDefault()} 
      onCut={(e) => e.preventDefault()}
    >
      <div className="space-y-2">
        {/* Title - full row */}
        <h3 
          id={legendId} 
          className={`text-lg font-medium text-[var(--foreground)] leading-relaxed select-none ${
            questionHasArabic ? 'arabic-text rtl' : ''
          }`}
          dir={questionHasArabic ? 'rtl' : 'ltr'}
          lang={questionHasArabic ? 'ar' : undefined}
          translate="no"
        >
          {q.required && <span className="text-red-500 mr-1">*</span>}
          {q.question_text}
        </h3>

        {/* Second row: left points, right answered/clear */}
        <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-2">
          <div>
            {q.points && (
              <p className="text-sm text-[var(--muted-foreground)] select-none">
                {translate(locale, 'points')} {q.points}
              </p>
            )}
          </div>
          <div className="flex items-center justify-start sm:justify-end gap-2">
            {/* Answer status indicator */}
            {isAnswered() && (
              <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {translate(locale, 'answered')}
              </div>
            )}
            {/* Clear button */}
            {isAnswered() && !disabled && (
              <button
                onClick={clearAnswer}
                className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                title={translate(locale, 'clear_answer')}
                aria-label={translate(locale, 'clear_answer')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4">
        {renderInput(qType)}
      </div>
    </div>
  );

  function renderInput(type: QuestionType) {
    switch (type) {
      case "true_false": {
        // Don't convert to Boolean - keep null/undefined as no selection
        const v = value as boolean | null | undefined;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby={legendId}>
            <label className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
              v === true ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--muted)]/50'
            }`}>
              <input
                type="radio"
                name={id}
                disabled={disabled}
                required={q.required}
                checked={v === true}
                onChange={() => handleChange(true)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="font-medium">{translate(locale, 'true')}</span>
            </label>
            <label className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
              v === false ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--muted)]/50'
            }`}>
              <input
                type="radio"
                name={id}
                disabled={disabled}
                required={q.required}
                checked={v === false}
                onChange={() => handleChange(false)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="font-medium">{translate(locale, 'false')}</span>
            </label>
          </div>
        );
      }
      case "single_choice": {
        const opts = (q.options as string[] | null) ?? [];
        const v = (value as string) ?? "";
        return (
          <div className="space-y-3" role="radiogroup" aria-labelledby={legendId}>
            {opts.map((opt, idx) => {
              const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D...
              const isSelected = v === opt;
              return (
                <label key={idx} className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--muted)]/50'
                }`}>
                  <input
                    type="radio"
                    name={id}
                    disabled={disabled}
                    required={q.required}
                    checked={isSelected}
                    onChange={() => handleChange(opt)}
                    className="w-4 h-4 text-blue-600 mt-1"
                  />
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                    }`}>
                      {optionLetter}
                    </div>
                    <span 
                      className={`flex-1 leading-relaxed select-none ${hasArabic(opt) ? 'arabic-text rtl' : ''}`}
                      dir={hasArabic(opt) ? 'rtl' : 'ltr'}
                      lang={hasArabic(opt) ? 'ar' : undefined}
                      translate="no"
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
      case "multiple_choice":
      case "multi_select": {
        const opts = (q.options as string[] | null) ?? [];
        const v = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="space-y-3" role="group" aria-labelledby={legendId}>
            <p className="text-sm text-[var(--muted-foreground)] mb-3">
              {translate(locale, 'select_all_apply_with_count', { count: v.length })}
            </p>
            {opts.map((opt, idx) => {
              const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D...
              const isSelected = v.includes(opt);
              return (
                <label key={idx} className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--muted)]/50'
                }`}>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={isSelected}
                    onChange={(e) => {
                      const newValue = e.target.checked ? [...v, opt] : v.filter((x) => x !== opt);
                      handleChange(newValue);
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
                      className={`flex-1 leading-relaxed select-none ${hasArabic(opt) ? 'arabic-text rtl' : ''}`}
                      dir={hasArabic(opt) ? 'rtl' : 'ltr'}
                      lang={hasArabic(opt) ? 'ar' : undefined}
                      translate="no"
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
      case "paragraph": {
        const v = (value as string) ?? "";
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
              value={v}
              onChange={(e) => handleChange(e.target.value)}
              aria-labelledby={legendId}
              aria-required={q.required || undefined}
              placeholder={translate(locale, 'type_answer_here')}
              dir="auto"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              translate="no"
            />
            <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
              <span>{translate(locale, 'be_detailed')}</span>
              <span>{translate(locale, 'characters_count', { count: v.length })}</span>
            </div>
          </div>
        );
      }
      default:
        return <div>{translate(locale, 'unsupported_question_type')}</div>;
    }
  }
}
