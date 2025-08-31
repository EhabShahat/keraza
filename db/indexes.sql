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

 -- IP rules lookups (create only if table exists)
 do $$ begin
   if to_regclass('public.exam_ips') is not null then
     -- Support quick filtering by exam and rule type
     execute 'create index if not exists idx_ips_exam_rule on public.exam_ips (exam_id, rule_type)';
     -- Optional helper index on ip_range for operations; may not accelerate << but harmless
     execute 'create index if not exists idx_ips_ip_range on public.exam_ips (ip_range)';
   end if;
end $$;

-- Single-exam enforcement removed: allow multiple published exams concurrently.

-- Drop legacy unique index that enforced a single published exam
drop index if exists one_published_exam;
