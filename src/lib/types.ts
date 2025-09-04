export type QuestionType =
  | "true_false"
  | "single_choice"
  | "multiple_choice"
  | "multi_select"
  | "short_answer"
  | "paragraph";

export interface Question {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options?: string[] | null;
  correct_answers?: unknown;
  points: number;
  required: boolean;
  order_index: number | null;
}

export interface ExamInfo {
  id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  settings: Record<string, unknown>;
  access_type: string;
}

export interface AttemptState {
  attemptId: string;
  version: number;
  started_at: string;
  exam: ExamInfo;
  auto_save_data: any;
  answers: Record<string, unknown>;
  completion_status: "in_progress" | "submitted" | "abandoned" | "invalid";
  submitted_at: string | null;
  questions: Question[];
}
