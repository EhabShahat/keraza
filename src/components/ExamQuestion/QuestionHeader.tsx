import { QuestionHeaderProps } from "./types";
import { hasArabic } from "./utils";

export default function QuestionHeader({ 
  q, 
  isAnswered, 
  onClear, 
  disabled, 
  legendId 
}: QuestionHeaderProps) {
  const questionHasArabic = hasArabic(q.question_text);
  
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <h3 
          id={legendId} 
          className={`text-lg font-medium text-[var(--foreground)] leading-relaxed flex-1 select-none flex items-baseline gap-1 ${
            questionHasArabic ? 'arabic-text' : ''
          }`}
          dir={questionHasArabic ? 'rtl' : 'ltr'}
        >
          {q.required && <span className="text-red-500">*</span>}
          {q.question_text}
        </h3>
        
        <div className="flex items-center gap-2">
          {/* Answer status indicator */}
          {isAnswered && (
            <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Answered
            </div>
          )}
          
          {/* Clear button */}
          {isAnswered && !disabled && (
            <button
              onClick={onClear}
              className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
              title="Clear answer"
              aria-label="Clear answer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Question image (optional) */}
      {q.question_image_url && (
        <div className="mt-2">
          <img
            src={q.question_image_url}
            alt="Question"
            className="max-h-64 rounded border"
            draggable={false}
          />
        </div>
      )}

      {q.points && (
        <p className="text-sm text-[var(--muted-foreground)] select-none">
          Points: {q.points}
        </p>
      )}
    </div>
  );
}