export interface ExamResult {
  id: string;
  exam_id: string;
  exam_title: string;
  student_name: string;
  student_code: string;
  completion_status: string;
  submitted_at: string | null;
  score_percentage: number | null;
  is_pass?: boolean | null;
  pass_threshold?: number | null;
}
