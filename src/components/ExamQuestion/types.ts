import { Question, QuestionType } from "@/lib/types";

export type AnswerValue = string | boolean | string[] | null;

export interface ExamQuestionProps {
  q: Question;
  value: AnswerValue;
  onChange: (val: AnswerValue) => void;
  disabled?: boolean;
  onSave?: () => void;
  attemptId?: string;
}

export interface QuestionHeaderProps {
  q: Question;
  isAnswered: boolean;
  onClear: () => void;
  disabled?: boolean;
  legendId: string;
}

export interface InputRendererProps {
  type: QuestionType;
  q: Question;
  value: AnswerValue;
  onChange: (val: AnswerValue) => void;
  disabled?: boolean;
  legendId: string;
  attemptId?: string;
}

export interface TrueFalseInputProps {
  value: boolean | null | undefined;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  id: string;
  legendId: string;
}

export interface SingleChoiceInputProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  required?: boolean;
  id: string;
  legendId: string;
  optionImageUrls?: (string | null)[] | null;
}

export interface MultiSelectInputProps {
  options: string[];
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
  required?: boolean;
  id: string;
  legendId: string;
  optionImageUrls?: (string | null)[] | null;
}

export interface ParagraphInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  required?: boolean;
  id: string;
  legendId: string;
}

export interface PhotoUploadInputProps {
  value: string;
  onChange: (val: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  id: string;
  legendId: string;
  attemptId?: string;
}