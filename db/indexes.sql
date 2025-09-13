-- Recommended indexes and constraints
 
 -- legacy exam_codes index removed after migration to global students
 
 -- Questions ordering and querying
 create index if not exists idx_questions_exam_order on public.questions (exam_id, order_index);
 
 -- Attempts by exam and recency
 create index if not exists idx_attempts_exam_started on public.exam_attempts (exam_id, started_at desc);
 create index if not exists idx_attempts_exam_student_lower on public.exam_attempts (exam_id, lower(student_name));
 create index if not exists idx_attempts_submitted_at on public.exam_attempts (submitted_at desc);
 -- Fast per-IP limiting by exam
 create index if not exists idx_attempts_exam_ip on public.exam_attempts (exam_id, ip_address);
 
 -- Results join support (join via attempt_id -> exam_attempts.exam_id)
 create index if not exists idx_results_attempt_id on public.exam_results (attempt_id);

 -- Global tables performance
 -- Ensure fast lookups and enforce single attempt per student per exam
 create index if not exists idx_attempts_student_id on public.exam_attempts (student_id);
 create unique index if not exists uniq_sea_exam_student on public.student_exam_attempts (exam_id, student_id);
 create index if not exists idx_sea_exam on public.student_exam_attempts (exam_id, started_at desc);
 create index if not exists idx_sea_student on public.student_exam_attempts (student_id);
 create index if not exists idx_sea_attempt_id on public.student_exam_attempts (attempt_id);

 -- Performance optimization indexes
 -- Composite indexes for common query patterns
 create index if not exists idx_attempts_exam_status_submitted on public.exam_attempts (exam_id, completion_status, submitted_at desc);
 create index if not exists idx_attempts_status_updated on public.exam_attempts (completion_status, updated_at desc);
 create index if not exists idx_exams_status_created on public.exams (status, created_at desc);
 
 -- Indexes for monitoring and analytics
 create index if not exists idx_attempts_started_status on public.exam_attempts (started_at desc, completion_status);
 create index if not exists idx_results_score_calculated on public.exam_results (final_score_percentage desc, calculated_at desc);
 
 -- Activity events performance
 create index if not exists idx_activity_events_attempt_type on public.attempt_activity_events (attempt_id, event_type, created_at desc);
 create index if not exists idx_activity_events_time on public.attempt_activity_events (created_at desc);
 
 -- Manual grades performance
 create index if not exists idx_manual_grades_attempt on public.manual_grades (attempt_id);
 create index if not exists idx_manual_grades_question on public.manual_grades (question_id);
 
 -- App config performance
 create index if not exists idx_app_config_key on public.app_config (key);
 
 -- Students performance
 create index if not exists idx_students_code_lower on public.students (lower(code));
 create index if not exists idx_students_name_lower on public.students (lower(student_name)) where student_name is not null;
 
 -- Audit logs performance
 create index if not exists idx_audit_logs_created_actor on public.audit_logs (created_at desc, actor);
 create index if not exists idx_audit_logs_action_created on public.audit_logs (action, created_at desc);

 -- IP rules lookups (create only if table exists)
 do $ begin
   if to_regclass('public.exam_ips') is not null then
     -- Support quick filtering by exam and rule type
     execute 'create index if not exists idx_ips_exam_rule on public.exam_ips (exam_id, rule_type)';
     -- Optional helper index on ip_range for operations; may not accelerate << but harmless
     execute 'create index if not exists idx_ips_ip_range on public.exam_ips (ip_range)';
   end if;
 end $;

-- Single-exam enforcement removed: allow multiple published exams concurrently.
-- Drop legacy unique index that enforced a single published exam
drop index if exists one_published_exam;