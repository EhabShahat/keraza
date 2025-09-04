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

 -- IP rules lookups (create only if table exists)
 do $$ begin
   if to_regclass('public.exam_ips') is not null then
     -- Support quick filtering by exam and rule type
     execute 'create index if not exists idx_ips_exam_rule on public.exam_ips (exam_id, rule_type)';
     -- Optional helper index on ip_range for operations; may not accelerate << but harmless
     execute 'create index if not exists idx_ips_ip_range on public.exam_ips (ip_range)';
   end if;
 end $$;

 -- Ensure at most one active (published) exam at a time
 do $$
 begin
   -- If multiple exams are currently published, archive all but the most recently updated/created
   if (select count(*) from public.exams where status = 'published') > 1 then
     with ranked as (
       select id,
              row_number() over (order by coalesce(updated_at, created_at) desc nulls last) as rn
       from public.exams
       where status = 'published'
     )
     update public.exams e
       set status = 'archived'
     from ranked r
     where e.id = r.id and r.rn > 1;
   end if;
 end $$;
 
 -- Partial unique index to enforce single published exam
 create unique index if not exists one_published_exam
   on public.exams (status)
   where status = 'published';
