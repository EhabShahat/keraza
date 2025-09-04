"use client";

import React, { useId } from "react";
import type { QuestionType } from "@/lib/types";
import { AnswerValue, ExamQuestionProps } from "./types";
import QuestionHeader from "./QuestionHeader";
import InputRenderer from "./InputRenderer";

export default function ExamQuestion({
  q,
  value,
  onChange,
  disabled,
  onSave,
}: ExamQuestionProps) {
  const id = useId();
  const t = q.question_type as QuestionType;
  const legendId = `${id}-legend`;
  
  // Handle answer change with auto-save
  const handleChange = (newValue: AnswerValue) => {
    // Only propagate the change; parent manages debounced/queued saving
    onChange(newValue);
  };
  
  // Clear answer function
  const clearAnswer = () => {
    // Only clear locally; parent manages saving
    onChange(null);
  };
  
  // Check if question is answered
  const isAnswered = () => {
    if (t === "paragraph") {
      return typeof value === "string" && value.trim().length > 0;
    } else if (t === "true_false") {
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
      <QuestionHeader
        q={q}
        isAnswered={isAnswered()}
        onClear={clearAnswer}
        disabled={disabled}
        legendId={legendId}
      />
      <div className="mt-4">
        <InputRenderer
          type={t}
          q={q}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          legendId={legendId}
        />
      </div>
    </div>
  );
}

export type { AnswerValue } from "./types";