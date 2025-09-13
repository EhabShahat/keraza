-- Optimized RPC functions for attempt management
-- These functions consolidate multiple operations and reduce round trips

-- Batch get attempt states for monitoring dashboard
CREATE OR REPLACE FUNCTION public.batch_get_attempt_states(p_attempt_ids uuid[])
RETURNS TABLE(
  attempt_id uuid,
  exam_id uuid,
  exam_title text,
  student_name text,
  student_code text,
  started_at timestamptz,
  submitted_at timestamptz,
  completion_status text,
  progress jsonb,
  ip_address inet
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as attempt_id,
    a.exam_id,
    e.title as exam_title,
    COALESCE(s.student_name, a.student_name) as student_name,
    s.code as student_code,
    a.started_at,
    a.submitted_at,
    a.completion_status,
    a.auto_save_data->'progress' as progress,
    a.ip_address
  FROM public.exam_attempts a
  JOIN public.exams e ON e.id = a.exam_id
  LEFT JOIN public.students s ON s.id = a.student_id
  WHERE a.id = ANY(p_attempt_ids)
  ORDER BY a.started_at DESC;
END;
$function$;

-- Optimized function to get exam summary with attempt counts
CREATE OR REPLACE FUNCTION public.get_exam_summary_with_attempts(p_exam_id uuid)
RETURNS TABLE(
  exam_id uuid,
  title text,
  description text,
  status text,
  total_attempts integer,
  completed_attempts integer,
  in_progress_attempts integer,
  average_score numeric,
  last_activity timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as exam_id,
    e.title,
    e.description,
    e.status,
    COUNT(a.id)::integer as total_attempts,
    COUNT(CASE WHEN a.completion_status = 'submitted' THEN 1 END)::integer as completed_attempts,
    COUNT(CASE WHEN a.completion_status = 'in_progress' THEN 1 END)::integer as in_progress_attempts,
    COALESCE(AVG(er.final_score_percentage), 0) as average_score,
    MAX(a.updated_at) as last_activity
  FROM public.exams e
  LEFT JOIN public.exam_attempts a ON a.exam_id = e.id
  LEFT JOIN public.exam_results er ON er.attempt_id = a.id
  WHERE e.id = p_exam_id
  GROUP BY e.id, e.title, e.description, e.status;
END;
$function$;

-- Batch update attempt progress (for auto-save optimization)
CREATE OR REPLACE FUNCTION public.batch_update_attempt_progress(
  p_updates jsonb
)
RETURNS TABLE(updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_update jsonb;
  v_count integer := 0;
BEGIN
  -- p_updates should be an array of objects with attempt_id, answers, auto_save_data, expected_version
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    BEGIN
      UPDATE public.exam_attempts
      SET 
        answers = COALESCE((v_update->>'answers')::jsonb, answers),
        auto_save_data = COALESCE((v_update->>'auto_save_data')::jsonb, auto_save_data),
        version = version + 1,
        updated_at = now()
      WHERE id = (v_update->>'attempt_id')::uuid
        AND version = (v_update->>'expected_version')::integer
        AND submitted_at IS NULL
        AND completion_status = 'in_progress';
      
      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip failed updates and continue with batch
      CONTINUE;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_count;
END;
$function$;

-- Optimized function to get active attempts for monitoring
CREATE OR REPLACE FUNCTION public.get_active_attempts_summary()
RETURNS TABLE(
  exam_id uuid,
  exam_title text,
  active_count integer,
  recent_submissions integer,
  avg_duration_minutes numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as exam_id,
    e.title as exam_title,
    COUNT(CASE WHEN a.completion_status = 'in_progress' THEN 1 END)::integer as active_count,
    COUNT(CASE WHEN a.submitted_at > now() - interval '1 hour' THEN 1 END)::integer as recent_submissions,
    AVG(EXTRACT(EPOCH FROM (COALESCE(a.submitted_at, now()) - a.started_at)) / 60) as avg_duration_minutes
  FROM public.exams e
  LEFT JOIN public.exam_attempts a ON a.exam_id = e.id
  WHERE e.status = 'published'
  GROUP BY e.id, e.title
  HAVING COUNT(a.id) > 0
  ORDER BY active_count DESC, recent_submissions DESC;
END;
$function$;

-- Optimized student lookup with attempt history
CREATE OR REPLACE FUNCTION public.get_student_with_attempts(p_code text)
RETURNS TABLE(
  student_id uuid,
  code text,
  student_name text,
  mobile_number text,
  total_attempts integer,
  completed_attempts integer,
  last_attempt_date timestamptz,
  available_exams jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_student_id uuid;
BEGIN
  -- Get student info
  SELECT s.id INTO v_student_id
  FROM public.students s
  WHERE s.code = p_code;
  
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'student_not_found';
  END IF;
  
  RETURN QUERY
  SELECT 
    s.id as student_id,
    s.code,
    s.student_name,
    s.mobile_number,
    COUNT(sea.id)::integer as total_attempts,
    COUNT(CASE WHEN sea.status = 'completed' THEN 1 END)::integer as completed_attempts,
    MAX(sea.started_at) as last_attempt_date,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'exam_id', e.id,
          'title', e.title,
          'can_attempt', (sea.id IS NULL AND e.status = 'published')
        ) ORDER BY e.created_at DESC
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'::jsonb
    ) as available_exams
  FROM public.students s
  LEFT JOIN public.student_exam_attempts sea ON sea.student_id = s.id
  LEFT JOIN public.exams e ON (e.access_type = 'code_based' AND e.status = 'published')
  WHERE s.id = v_student_id
  GROUP BY s.id, s.code, s.student_name, s.mobile_number;
END;
$function$;

-- Batch calculate results for multiple attempts (for bulk regrading)
CREATE OR REPLACE FUNCTION public.batch_calculate_results(p_attempt_ids uuid[])
RETURNS TABLE(
  attempt_id uuid,
  total_questions integer,
  correct_count integer,
  score_percentage numeric,
  auto_points numeric,
  manual_points numeric,
  max_points numeric,
  final_score_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_attempt_id uuid;
  v_result record;
BEGIN
  FOREACH v_attempt_id IN ARRAY p_attempt_ids
  LOOP
    BEGIN
      SELECT * INTO v_result 
      FROM public.calculate_result_for_attempt(v_attempt_id);
      
      RETURN QUERY SELECT 
        v_attempt_id,
        v_result.total_questions,
        v_result.correct_count,
        v_result.score_percentage,
        v_result.auto_points,
        v_result.manual_points,
        v_result.max_points,
        v_result.final_score_percentage;
    EXCEPTION WHEN OTHERS THEN
      -- Skip failed calculations and continue
      CONTINUE;
    END;
  END LOOP;
END;
$function$;

-- Optimized query to get exam performance analytics
CREATE OR REPLACE FUNCTION public.get_exam_analytics(p_exam_id uuid)
RETURNS TABLE(
  total_attempts integer,
  completed_attempts integer,
  average_score numeric,
  median_score numeric,
  score_distribution jsonb,
  question_analytics jsonb,
  time_analytics jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  RETURN QUERY
  WITH attempt_stats AS (
    SELECT 
      a.id,
      a.started_at,
      a.submitted_at,
      EXTRACT(EPOCH FROM (a.submitted_at - a.started_at)) / 60 as duration_minutes,
      er.final_score_percentage as score
    FROM public.exam_attempts a
    LEFT JOIN public.exam_results er ON er.attempt_id = a.id
    WHERE a.exam_id = p_exam_id
  ),
  score_ranges AS (
    SELECT 
      COUNT(CASE WHEN score >= 90 THEN 1 END) as excellent,
      COUNT(CASE WHEN score >= 80 AND score < 90 THEN 1 END) as good,
      COUNT(CASE WHEN score >= 70 AND score < 80 THEN 1 END) as satisfactory,
      COUNT(CASE WHEN score >= 60 AND score < 70 THEN 1 END) as needs_improvement,
      COUNT(CASE WHEN score < 60 THEN 1 END) as poor
    FROM attempt_stats
    WHERE score IS NOT NULL
  )
  SELECT 
    COUNT(*)::integer as total_attempts,
    COUNT(submitted_at)::integer as completed_attempts,
    COALESCE(AVG(score), 0) as average_score,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score), 0) as median_score,
    jsonb_build_object(
      'excellent', sr.excellent,
      'good', sr.good,
      'satisfactory', sr.satisfactory,
      'needs_improvement', sr.needs_improvement,
      'poor', sr.poor
    ) as score_distribution,
    '[]'::jsonb as question_analytics, -- Placeholder for detailed question analysis
    jsonb_build_object(
      'avg_duration_minutes', COALESCE(AVG(duration_minutes), 0),
      'min_duration_minutes', COALESCE(MIN(duration_minutes), 0),
      'max_duration_minutes', COALESCE(MAX(duration_minutes), 0)
    ) as time_analytics
  FROM attempt_stats, score_ranges sr;
END;
$function$;

-- Optimized batch operations for multiple exams
CREATE OR REPLACE FUNCTION public.batch_get_exam_summaries(p_exam_ids uuid[])
RETURNS TABLE(
  exam_id uuid,
  title text,
  description text,
  status text,
  total_attempts integer,
  completed_attempts integer,
  in_progress_attempts integer,
  average_score numeric,
  last_activity timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as exam_id,
    e.title,
    e.description,
    e.status,
    COUNT(a.id)::integer as total_attempts,
    COUNT(CASE WHEN a.completion_status = 'submitted' THEN 1 END)::integer as completed_attempts,
    COUNT(CASE WHEN a.completion_status = 'in_progress' THEN 1 END)::integer as in_progress_attempts,
    COALESCE(AVG(er.final_score_percentage), 0) as average_score,
    MAX(a.updated_at) as last_activity
  FROM public.exams e
  LEFT JOIN public.exam_attempts a ON a.exam_id = e.id
  LEFT JOIN public.exam_results er ON er.attempt_id = a.id
  WHERE e.id = ANY(p_exam_ids)
  GROUP BY e.id, e.title, e.description, e.status
  ORDER BY e.created_at DESC;
END;
$function$;

-- Optimized function for bulk student operations
CREATE OR REPLACE FUNCTION public.batch_student_operations(
  p_operations jsonb
)
RETURNS TABLE(
  operation_id text,
  success boolean,
  result jsonb,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  operation_item jsonb;
  op_id text;
  op_type text;
  op_params jsonb;
  op_result jsonb;
BEGIN
  FOR operation_item IN SELECT * FROM jsonb_array_elements(p_operations)
  LOOP
    BEGIN
      op_id := operation_item->>'id';
      op_type := operation_item->>'type';
      op_params := operation_item->'params';
      
      CASE op_type
        WHEN 'validate_codes' THEN
          -- Validate multiple student codes at once
          WITH validation_results AS (
            SELECT 
              code_item->>'code' as code,
              EXISTS(SELECT 1 FROM public.students s WHERE s.code = code_item->>'code') as exists,
              CASE WHEN (code_item->>'exam_id') IS NOT NULL THEN
                NOT EXISTS(
                  SELECT 1 FROM public.student_exam_attempts sea 
                  JOIN public.students s ON s.id = sea.student_id
                  WHERE s.code = code_item->>'code' 
                    AND sea.exam_id = (code_item->>'exam_id')::uuid
                )
              ELSE true END as available
            FROM jsonb_array_elements(op_params->'codes') as code_item
          )
          SELECT jsonb_agg(
            jsonb_build_object(
              'code', vr.code,
              'valid', vr.exists AND vr.available,
              'exists', vr.exists,
              'available', vr.available
            )
          ) INTO op_result
          FROM validation_results vr;
          
        WHEN 'bulk_create' THEN
          -- Bulk create students
          DECLARE
            student_item jsonb;
            created_count integer := 0;
            skipped_count integer := 0;
          BEGIN
            FOR student_item IN SELECT * FROM jsonb_array_elements(op_params->'students')
            LOOP
              BEGIN
                INSERT INTO public.students (code, student_name, mobile_number)
                VALUES (
                  student_item->>'code',
                  student_item->>'student_name',
                  student_item->>'mobile_number'
                );
                created_count := created_count + 1;
              EXCEPTION WHEN unique_violation THEN
                skipped_count := skipped_count + 1;
              END;
            END LOOP;
            
            op_result := jsonb_build_object(
              'created_count', created_count,
              'skipped_count', skipped_count
            );
          END;
          
        WHEN 'bulk_lookup' THEN
          -- Bulk lookup student information
          SELECT jsonb_agg(
            jsonb_build_object(
              'code', s.code,
              'student_name', s.student_name,
              'mobile_number', s.mobile_number,
              'id', s.id,
              'created_at', s.created_at
            )
          ) INTO op_result
          FROM public.students s
          WHERE s.code = ANY(
            SELECT jsonb_array_elements_text(op_params->'codes')
          );
          
        ELSE
          RAISE EXCEPTION 'invalid_operation_type: %', op_type;
      END CASE;
      
      RETURN QUERY SELECT op_id, true, op_result, null::text;
      
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT op_id, false, null::jsonb, SQLERRM::text;
    END;
  END LOOP;
END;
$function$;

-- Optimized function for system health and performance monitoring
CREATE OR REPLACE FUNCTION public.get_system_health_metrics()
RETURNS TABLE(
  metric_category text,
  metric_name text,
  metric_value numeric,
  metric_unit text,
  status text,
  threshold_warning numeric,
  threshold_critical numeric,
  last_updated timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  -- Database performance metrics
  RETURN QUERY
  SELECT 
    'database'::text as metric_category,
    'active_connections'::text as metric_name,
    (SELECT count(*)::numeric FROM pg_stat_activity WHERE state = 'active') as metric_value,
    'connections'::text as metric_unit,
    CASE 
      WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') > 50 THEN 'critical'
      WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') > 30 THEN 'warning'
      ELSE 'healthy'
    END as status,
    30::numeric as threshold_warning,
    50::numeric as threshold_critical,
    NOW() as last_updated;
  
  -- Attempt processing metrics
  RETURN QUERY
  SELECT 
    'attempts'::text,
    'active_attempts'::text,
    COUNT(*)::numeric,
    'attempts'::text,
    CASE 
      WHEN COUNT(*) > 1000 THEN 'critical'
      WHEN COUNT(*) > 500 THEN 'warning'
      ELSE 'healthy'
    END,
    500::numeric,
    1000::numeric,
    NOW()
  FROM public.exam_attempts
  WHERE completion_status = 'in_progress'
    AND started_at > NOW() - INTERVAL '24 hours';
  
  -- Recent error rate
  RETURN QUERY
  WITH error_stats AS (
    SELECT 
      COUNT(CASE WHEN event_type = 'error' THEN 1 END) as error_count,
      COUNT(*) as total_events
    FROM public.attempt_activity_events
    WHERE event_time > NOW() - INTERVAL '1 hour'
  )
  SELECT 
    'system'::text,
    'error_rate'::text,
    CASE WHEN es.total_events > 0 THEN 
      (es.error_count::numeric / es.total_events) * 100 
    ELSE 0 END,
    'percentage'::text,
    CASE 
      WHEN es.total_events > 0 AND (es.error_count::numeric / es.total_events) > 0.1 THEN 'critical'
      WHEN es.total_events > 0 AND (es.error_count::numeric / es.total_events) > 0.05 THEN 'warning'
      ELSE 'healthy'
    END,
    5::numeric,
    10::numeric,
    NOW()
  FROM error_stats es;
  
  -- Storage usage (approximate)
  RETURN QUERY
  SELECT 
    'storage'::text,
    'database_size'::text,
    (SELECT pg_database_size(current_database())::numeric / (1024*1024*1024)) as metric_value,
    'GB'::text,
    CASE 
      WHEN (SELECT pg_database_size(current_database()) / (1024*1024*1024)) > 10 THEN 'critical'
      WHEN (SELECT pg_database_size(current_database()) / (1024*1024*1024)) > 5 THEN 'warning'
      ELSE 'healthy'
    END,
    5::numeric,
    10::numeric,
    NOW();
END;
$function$;

-- Optimized function for comprehensive exam dashboard data
CREATE OR REPLACE FUNCTION public.get_exam_dashboard_data(p_exam_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
  exam_id uuid,
  exam_title text,
  exam_status text,
  total_attempts integer,
  active_attempts integer,
  completed_attempts integer,
  average_score numeric,
  recent_activity jsonb,
  performance_trend jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  RETURN QUERY
  WITH exam_stats AS (
    SELECT 
      e.id,
      e.title,
      e.status,
      COUNT(a.id) as total_attempts,
      COUNT(CASE WHEN a.completion_status = 'in_progress' THEN 1 END) as active_attempts,
      COUNT(CASE WHEN a.completion_status = 'submitted' THEN 1 END) as completed_attempts,
      COALESCE(AVG(er.final_score_percentage), 0) as avg_score
    FROM public.exams e
    LEFT JOIN public.exam_attempts a ON a.exam_id = e.id
    LEFT JOIN public.exam_results er ON er.attempt_id = a.id
    WHERE (p_exam_ids IS NULL OR e.id = ANY(p_exam_ids))
    GROUP BY e.id, e.title, e.status
  ),
  recent_activity AS (
    SELECT 
      es.id,
      jsonb_agg(
        jsonb_build_object(
          'attempt_id', a.id,
          'student_name', COALESCE(s.student_name, a.student_name),
          'started_at', a.started_at,
          'status', a.completion_status
        ) ORDER BY a.started_at DESC
      ) FILTER (WHERE a.started_at > NOW() - INTERVAL '2 hours') as recent_attempts
    FROM exam_stats es
    LEFT JOIN public.exam_attempts a ON a.exam_id = es.id
    LEFT JOIN public.students s ON s.id = a.student_id
    GROUP BY es.id
  ),
  performance_trend AS (
    SELECT 
      es.id,
      jsonb_agg(
        jsonb_build_object(
          'date', date_trunc('hour', a.submitted_at),
          'avg_score', AVG(er.final_score_percentage),
          'attempt_count', COUNT(*)
        ) ORDER BY date_trunc('hour', a.submitted_at)
      ) FILTER (WHERE a.submitted_at > NOW() - INTERVAL '24 hours') as trend_data
    FROM exam_stats es
    LEFT JOIN public.exam_attempts a ON a.exam_id = es.id AND a.completion_status = 'submitted'
    LEFT JOIN public.exam_results er ON er.attempt_id = a.id
    GROUP BY es.id, date_trunc('hour', a.submitted_at)
  )
  SELECT 
    es.id,
    es.title,
    es.status,
    es.total_attempts::integer,
    es.active_attempts::integer,
    es.completed_attempts::integer,
    es.avg_score,
    COALESCE(ra.recent_attempts, '[]'::jsonb),
    COALESCE(pt.trend_data, '[]'::jsonb)
  FROM exam_stats es
  LEFT JOIN recent_activity ra ON ra.id = es.id
  LEFT JOIN performance_trend pt ON pt.id = es.id
  ORDER BY es.total_attempts DESC;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.batch_get_attempt_states(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_exam_summary_with_attempts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.batch_update_attempt_progress(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_active_attempts_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_student_with_attempts(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.batch_calculate_results(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_exam_analytics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.batch_get_exam_summaries(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.batch_student_operations(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_system_health_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_exam_dashboard_data(uuid[]) TO service_role;

-- Also grant to anon/authenticated for public functions
GRANT EXECUTE ON FUNCTION public.get_student_with_attempts(text) TO anon, authenticated;