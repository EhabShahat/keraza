-- Consolidated RPC Functions
-- These functions combine multiple operations to reduce round trips

-- Consolidated attempt management function
-- Handles start, save, submit, and state operations in one function
CREATE OR REPLACE FUNCTION public.attempt_manager(
  p_operation text,
  p_exam_id uuid DEFAULT NULL,
  p_attempt_id uuid DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_student_name text DEFAULT NULL,
  p_ip inet DEFAULT NULL,
  p_answers jsonb DEFAULT NULL,
  p_auto_save_data jsonb DEFAULT NULL,
  p_expected_version integer DEFAULT NULL,
  p_device_info jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_result jsonb;
  v_attempt_id uuid;
  v_seed text;
  v_state jsonb;
  v_version integer;
BEGIN
  CASE p_operation
    WHEN 'start' THEN
      -- Start new attempt
      SELECT attempt_id, seed INTO v_attempt_id, v_seed
      FROM public.start_attempt(p_exam_id, p_code, p_student_name, p_ip);
      
      -- Update device info if provided
      IF p_device_info IS NOT NULL THEN
        UPDATE public.exam_attempts 
        SET device_info = p_device_info 
        WHERE id = v_attempt_id;
      END IF;
      
      v_result := jsonb_build_object(
        'success', true,
        'attempt_id', v_attempt_id,
        'seed', v_seed
      );
      
    WHEN 'save' THEN
      -- Save attempt progress
      SELECT new_version INTO v_version
      FROM public.save_attempt(p_attempt_id, p_answers, p_auto_save_data, p_expected_version);
      
      v_result := jsonb_build_object(
        'success', true,
        'new_version', v_version
      );
      
    WHEN 'submit' THEN
      -- Submit attempt and get results
      DECLARE
        v_total integer;
        v_correct integer;
        v_score numeric;
      BEGIN
        SELECT total_questions, correct_count, score_percentage 
        INTO v_total, v_correct, v_score
        FROM public.submit_attempt(p_attempt_id);
        
        v_result := jsonb_build_object(
          'success', true,
          'total_questions', v_total,
          'correct_count', v_correct,
          'score_percentage', v_score
        );
      END;
      
    WHEN 'state' THEN
      -- Get attempt state
      SELECT public.get_attempt_state(p_attempt_id) INTO v_state;
      
      v_result := jsonb_build_object(
        'success', true,
        'state', v_state
      );
      
    WHEN 'save_and_state' THEN
      -- Save and return updated state (common pattern)
      SELECT new_version INTO v_version
      FROM public.save_attempt(p_attempt_id, p_answers, p_auto_save_data, p_expected_version);
      
      SELECT public.get_attempt_state(p_attempt_id) INTO v_state;
      
      v_result := jsonb_build_object(
        'success', true,
        'new_version', v_version,
        'state', v_state
      );
      
    ELSE
      RAISE EXCEPTION 'invalid_operation: %', p_operation;
  END CASE;
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Consolidated admin operations function
CREATE OR REPLACE FUNCTION public.admin_manager(
  p_operation text,
  p_user_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_password text DEFAULT NULL,
  p_exam_id uuid DEFAULT NULL,
  p_attempt_id uuid DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_params jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_result jsonb;
  v_user_id uuid;
  v_count integer;
BEGIN
  -- Verify admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  
  CASE p_operation
    WHEN 'list_admins' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'username', username,
          'email', email
        )
      ) INTO v_result
      FROM public.admin_list_admins();
      
    WHEN 'add_admin' THEN
      SELECT user_id, email INTO v_user_id, p_email
      FROM public.admin_add_admin_by_email(p_email);
      
      v_result := jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', p_email
      );
      
    WHEN 'remove_admin' THEN
      PERFORM public.admin_remove_admin(p_user_id);
      v_result := jsonb_build_object('success', true);
      
    WHEN 'create_user' THEN
      SELECT user_id, username, email, is_admin INTO v_user_id, p_username, p_email, true
      FROM public.admin_create_user(p_username, p_email, p_password, COALESCE((p_params->>'is_admin')::boolean, false));
      
      v_result := jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'username', p_username,
        'email', p_email
      );
      
    WHEN 'regrade_exam' THEN
      SELECT regraded_count INTO v_count
      FROM public.regrade_exam(p_exam_id);
      
      v_result := jsonb_build_object(
        'success', true,
        'regraded_count', v_count
      );
      
    WHEN 'regrade_attempt' THEN
      DECLARE
        v_total integer;
        v_correct integer;
        v_score numeric;
        v_auto numeric;
        v_manual numeric;
        v_max numeric;
        v_final numeric;
      BEGIN
        SELECT total_questions, correct_count, score_percentage, auto_points, manual_points, max_points, final_score_percentage
        INTO v_total, v_correct, v_score, v_auto, v_manual, v_max, v_final
        FROM public.regrade_attempt(p_attempt_id);
        
        v_result := jsonb_build_object(
          'success', true,
          'total_questions', v_total,
          'correct_count', v_correct,
          'score_percentage', v_score,
          'auto_points', v_auto,
          'manual_points', v_manual,
          'max_points', v_max,
          'final_score_percentage', v_final
        );
      END;
      
    WHEN 'reset_student_attempts' THEN
      SELECT deleted_count INTO v_count
      FROM public.admin_reset_student_attempts(p_student_id, p_exam_id);
      
      v_result := jsonb_build_object(
        'success', true,
        'deleted_count', v_count
      );
      
    WHEN 'cleanup_expired' THEN
      SELECT auto_submitted_count INTO v_count
      FROM public.cleanup_expired_attempts();
      
      v_result := jsonb_build_object(
        'success', true,
        'auto_submitted_count', v_count
      );
      
    WHEN 'list_attempts' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'exam_id', exam_id,
          'started_at', started_at,
          'submitted_at', submitted_at,
          'completion_status', completion_status,
          'ip_address', ip_address,
          'student_name', student_name,
          'score_percentage', score_percentage,
          'final_score_percentage', final_score_percentage
        )
      ) INTO v_result
      FROM public.admin_list_attempts(p_exam_id);
      
    ELSE
      RAISE EXCEPTION 'invalid_operation: %', p_operation;
  END CASE;
  
  RETURN COALESCE(v_result, jsonb_build_object('success', true));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Consolidated student operations function
CREATE OR REPLACE FUNCTION public.student_manager(
  p_operation text,
  p_code text DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_exam_id uuid DEFAULT NULL,
  p_student_data jsonb DEFAULT NULL,
  p_bulk_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_result jsonb;
  v_student record;
  v_count integer;
BEGIN
  CASE p_operation
    WHEN 'get_by_code' THEN
      SELECT * INTO v_student FROM public.students WHERE code = p_code;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'student_not_found';
      END IF;
      
      v_result := jsonb_build_object(
        'id', v_student.id,
        'code', v_student.code,
        'student_name', v_student.student_name,
        'mobile_number', v_student.mobile_number,
        'created_at', v_student.created_at
      );
      
    WHEN 'get_with_attempts' THEN
      SELECT student_id, code, student_name, mobile_number, total_attempts, 
             completed_attempts, last_attempt_date, available_exams
      INTO v_student
      FROM public.get_student_with_attempts(p_code);
      
      v_result := to_jsonb(v_student);
      
    WHEN 'validate_code' THEN
      -- Check if code exists and is available for exam
      DECLARE
        v_student_id uuid;
        v_attempt_exists boolean := false;
      BEGIN
        SELECT id INTO v_student_id FROM public.students WHERE code = p_code;
        
        IF NOT FOUND THEN
          RAISE EXCEPTION 'invalid_code';
        END IF;
        
        IF p_exam_id IS NOT NULL THEN
          SELECT EXISTS(
            SELECT 1 FROM public.student_exam_attempts 
            WHERE student_id = v_student_id AND exam_id = p_exam_id
          ) INTO v_attempt_exists;
          
          IF v_attempt_exists THEN
            RAISE EXCEPTION 'code_already_used';
          END IF;
        END IF;
        
        v_result := jsonb_build_object(
          'valid', true,
          'student_id', v_student_id
        );
      END;
      
    WHEN 'bulk_insert' THEN
      -- Bulk insert students from JSON array
      DECLARE
        v_student_record jsonb;
        v_inserted_count integer := 0;
      BEGIN
        FOR v_student_record IN SELECT * FROM jsonb_array_elements(p_bulk_data)
        LOOP
          BEGIN
            INSERT INTO public.students (code, student_name, mobile_number)
            VALUES (
              v_student_record->>'code',
              v_student_record->>'student_name',
              v_student_record->>'mobile_number'
            );
            v_inserted_count := v_inserted_count + 1;
          EXCEPTION WHEN unique_violation THEN
            -- Skip duplicates
            CONTINUE;
          END;
        END LOOP;
        
        v_result := jsonb_build_object(
          'success', true,
          'inserted_count', v_inserted_count
        );
      END;
      
    ELSE
      RAISE EXCEPTION 'invalid_operation: %', p_operation;
  END CASE;
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Consolidated monitoring and analytics function
CREATE OR REPLACE FUNCTION public.monitoring_manager(
  p_operation text,
  p_exam_id uuid DEFAULT NULL,
  p_time_window interval DEFAULT '1 hour'::interval,
  p_params jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  CASE p_operation
    WHEN 'active_attempts' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'exam_id', exam_id,
          'exam_title', exam_title,
          'active_count', active_count,
          'recent_submissions', recent_submissions,
          'avg_duration_minutes', avg_duration_minutes
        )
      ) INTO v_result
      FROM public.get_active_attempts_summary();
      
    WHEN 'exam_analytics' THEN
      SELECT to_jsonb(analytics.*) INTO v_result
      FROM public.get_exam_analytics(p_exam_id) analytics;
      
    WHEN 'system_stats' THEN
      WITH stats AS (
        SELECT 
          COUNT(DISTINCT e.id) as total_exams,
          COUNT(DISTINCT CASE WHEN e.status = 'published' THEN e.id END) as published_exams,
          COUNT(DISTINCT s.id) as total_students,
          COUNT(DISTINCT a.id) as total_attempts,
          COUNT(DISTINCT CASE WHEN a.completion_status = 'submitted' THEN a.id END) as completed_attempts,
          COUNT(DISTINCT CASE WHEN a.started_at > now() - p_time_window THEN a.id END) as recent_attempts
        FROM public.exams e
        FULL OUTER JOIN public.exam_attempts a ON a.exam_id = e.id
        FULL OUTER JOIN public.students s ON true
      )
      SELECT to_jsonb(stats.*) INTO v_result FROM stats;
      
    WHEN 'performance_summary' THEN
      WITH perf AS (
        SELECT 
          AVG(EXTRACT(EPOCH FROM (COALESCE(a.submitted_at, now()) - a.started_at)) / 60) as avg_duration_minutes,
          COUNT(CASE WHEN a.completion_status = 'in_progress' THEN 1 END) as active_attempts,
          COUNT(CASE WHEN a.started_at > now() - '1 hour'::interval THEN 1 END) as recent_starts,
          COUNT(CASE WHEN a.submitted_at > now() - '1 hour'::interval THEN 1 END) as recent_submissions
        FROM public.exam_attempts a
        WHERE a.started_at > now() - p_time_window
      )
      SELECT to_jsonb(perf.*) INTO v_result FROM perf;
      
    ELSE
      RAISE EXCEPTION 'invalid_operation: %', p_operation;
  END CASE;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Consolidated exam management function
CREATE OR REPLACE FUNCTION public.exam_manager(
  p_operation text,
  p_exam_id uuid DEFAULT NULL,
  p_exam_data jsonb DEFAULT NULL,
  p_question_data jsonb DEFAULT NULL,
  p_settings jsonb DEFAULT NULL,
  p_params jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_result jsonb;
  v_exam_id uuid;
  v_count integer;
BEGIN
  CASE p_operation
    WHEN 'get_with_questions' THEN
      -- Get exam with all questions in one call
      WITH exam_data AS (
        SELECT to_jsonb(e.*) as exam_json
        FROM public.exams e
        WHERE e.id = p_exam_id
      ),
      questions_data AS (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'question_text', q.question_text,
            'question_type', q.question_type,
            'options', q.options,
            'correct_answers', q.correct_answers,
            'points', q.points,
            'required', q.required,
            'order_index', q.order_index,
            'question_image_url', q.question_image_url,
            'option_image_urls', q.option_image_urls
          ) ORDER BY q.order_index NULLS LAST, q.created_at
        ), '[]'::jsonb) as questions_json
        FROM public.questions q
        WHERE q.exam_id = p_exam_id
      )
      SELECT jsonb_build_object(
        'exam', ed.exam_json,
        'questions', qd.questions_json
      ) INTO v_result
      FROM exam_data ed, questions_data qd;
      
    WHEN 'get_summary_with_stats' THEN
      -- Get exam summary with attempt statistics
      SELECT to_jsonb(summary.*) INTO v_result
      FROM public.get_exam_summary_with_attempts(p_exam_id) summary;
      
    WHEN 'bulk_update_questions' THEN
      -- Bulk update questions for an exam
      DECLARE
        question_item jsonb;
        updated_count integer := 0;
      BEGIN
        FOR question_item IN SELECT * FROM jsonb_array_elements(p_question_data)
        LOOP
          UPDATE public.questions
          SET 
            question_text = COALESCE(question_item->>'question_text', question_text),
            question_type = COALESCE(question_item->>'question_type', question_type),
            options = COALESCE(question_item->'options', options),
            correct_answers = COALESCE(question_item->'correct_answers', correct_answers),
            points = COALESCE((question_item->>'points')::numeric, points),
            required = COALESCE((question_item->>'required')::boolean, required),
            order_index = COALESCE((question_item->>'order_index')::integer, order_index),
            updated_at = NOW()
          WHERE id = (question_item->>'id')::uuid
            AND exam_id = p_exam_id;
          
          IF FOUND THEN
            updated_count := updated_count + 1;
          END IF;
        END LOOP;
        
        v_result := jsonb_build_object(
          'success', true,
          'updated_count', updated_count
        );
      END;
      
    WHEN 'duplicate_with_questions' THEN
      -- Duplicate exam with all questions
      DECLARE
        v_new_exam_id uuid;
        v_original_exam record;
      BEGIN
        -- Get original exam
        SELECT * INTO v_original_exam FROM public.exams WHERE id = p_exam_id;
        
        IF NOT FOUND THEN
          RAISE EXCEPTION 'exam_not_found';
        END IF;
        
        -- Create new exam
        INSERT INTO public.exams (
          title, description, start_time, end_time, duration_minutes,
          access_type, status, settings, created_by
        )
        VALUES (
          COALESCE(p_exam_data->>'title', v_original_exam.title || ' (Copy)'),
          COALESCE(p_exam_data->>'description', v_original_exam.description),
          COALESCE((p_exam_data->>'start_time')::timestamptz, v_original_exam.start_time),
          COALESCE((p_exam_data->>'end_time')::timestamptz, v_original_exam.end_time),
          COALESCE((p_exam_data->>'duration_minutes')::integer, v_original_exam.duration_minutes),
          COALESCE(p_exam_data->>'access_type', v_original_exam.access_type),
          COALESCE(p_exam_data->>'status', 'draft'),
          COALESCE(p_exam_data->'settings', v_original_exam.settings),
          v_original_exam.created_by
        )
        RETURNING id INTO v_new_exam_id;
        
        -- Copy questions
        INSERT INTO public.questions (
          exam_id, question_text, question_type, options, correct_answers,
          points, required, order_index, question_image_url, option_image_urls
        )
        SELECT 
          v_new_exam_id, question_text, question_type, options, correct_answers,
          points, required, order_index, question_image_url, option_image_urls
        FROM public.questions
        WHERE exam_id = p_exam_id;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        
        v_result := jsonb_build_object(
          'success', true,
          'new_exam_id', v_new_exam_id,
          'questions_copied', v_count
        );
      END;
      
    ELSE
      RAISE EXCEPTION 'invalid_operation: %', p_operation;
  END CASE;
  
  RETURN COALESCE(v_result, jsonb_build_object('success', true));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Consolidated results and analytics function
CREATE OR REPLACE FUNCTION public.results_manager(
  p_operation text,
  p_exam_id uuid DEFAULT NULL,
  p_attempt_id uuid DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_time_range jsonb DEFAULT NULL,
  p_filters jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  CASE p_operation
    WHEN 'exam_results_summary' THEN
      -- Get comprehensive exam results with analytics
      WITH results_data AS (
        SELECT 
          a.id as attempt_id,
          a.started_at,
          a.submitted_at,
          a.completion_status,
          COALESCE(s.student_name, a.student_name) as student_name,
          s.code as student_code,
          er.total_questions,
          er.correct_count,
          er.score_percentage,
          er.final_score_percentage,
          EXTRACT(EPOCH FROM (a.submitted_at - a.started_at)) / 60 as duration_minutes
        FROM public.exam_attempts a
        LEFT JOIN public.students s ON s.id = a.student_id
        LEFT JOIN public.exam_results er ON er.attempt_id = a.id
        WHERE a.exam_id = p_exam_id
          AND (p_filters IS NULL OR 
               (p_filters->>'status' IS NULL OR a.completion_status = p_filters->>'status'))
      ),
      analytics AS (
        SELECT 
          COUNT(*) as total_attempts,
          COUNT(CASE WHEN completion_status = 'submitted' THEN 1 END) as completed_attempts,
          COALESCE(AVG(final_score_percentage), 0) as average_score,
          COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY final_score_percentage), 0) as median_score,
          COALESCE(AVG(duration_minutes), 0) as avg_duration_minutes,
          COUNT(CASE WHEN final_score_percentage >= 90 THEN 1 END) as excellent_count,
          COUNT(CASE WHEN final_score_percentage >= 80 AND final_score_percentage < 90 THEN 1 END) as good_count,
          COUNT(CASE WHEN final_score_percentage >= 70 AND final_score_percentage < 80 THEN 1 END) as satisfactory_count,
          COUNT(CASE WHEN final_score_percentage >= 60 AND final_score_percentage < 70 THEN 1 END) as needs_improvement_count,
          COUNT(CASE WHEN final_score_percentage < 60 THEN 1 END) as poor_count
        FROM results_data
        WHERE completion_status = 'submitted'
      )
      SELECT jsonb_build_object(
        'results', COALESCE((SELECT jsonb_agg(to_jsonb(rd.*)) FROM results_data rd), '[]'::jsonb),
        'analytics', (SELECT to_jsonb(a.*) FROM analytics a)
      ) INTO v_result;
      
    WHEN 'student_performance_history' THEN
      -- Get student performance across all exams
      SELECT jsonb_agg(
        jsonb_build_object(
          'exam_id', e.id,
          'exam_title', e.title,
          'attempt_id', a.id,
          'started_at', a.started_at,
          'submitted_at', a.submitted_at,
          'score_percentage', er.score_percentage,
          'final_score_percentage', er.final_score_percentage,
          'total_questions', er.total_questions,
          'correct_count', er.correct_count
        ) ORDER BY a.started_at DESC
      ) INTO v_result
      FROM public.exam_attempts a
      JOIN public.exams e ON e.id = a.exam_id
      LEFT JOIN public.exam_results er ON er.attempt_id = a.id
      WHERE a.student_id = p_student_id
        AND a.completion_status = 'submitted';
      
    WHEN 'question_analytics' THEN
      -- Detailed question performance analytics
      WITH question_stats AS (
        SELECT 
          q.id,
          q.question_text,
          q.question_type,
          q.points,
          COUNT(a.id) as total_attempts,
          COUNT(CASE 
            WHEN q.question_type IN ('multiple_choice', 'single_choice', 'true_false') THEN
              CASE WHEN (a.answers->q.id::text)::text = q.correct_answers::text THEN 1 END
            WHEN q.question_type = 'multi_select' THEN
              CASE WHEN (
                SELECT ARRAY(SELECT jsonb_array_elements_text(a.answers->q.id::text) ORDER BY 1)
              ) = (
                SELECT ARRAY(SELECT jsonb_array_elements_text(q.correct_answers) ORDER BY 1)
              ) THEN 1 END
          END) as correct_count,
          AVG(CASE 
            WHEN mg.awarded_points IS NOT NULL THEN mg.awarded_points
            ELSE 0
          END) as avg_manual_points
        FROM public.questions q
        LEFT JOIN public.exam_attempts a ON a.exam_id = q.exam_id AND a.completion_status = 'submitted'
        LEFT JOIN public.manual_grades mg ON mg.question_id = q.id AND mg.attempt_id = a.id
        WHERE q.exam_id = p_exam_id
        GROUP BY q.id, q.question_text, q.question_type, q.points
      )
      SELECT jsonb_agg(
        jsonb_build_object(
          'question_id', qs.id,
          'question_text', qs.question_text,
          'question_type', qs.question_type,
          'points', qs.points,
          'total_attempts', qs.total_attempts,
          'correct_count', qs.correct_count,
          'success_rate', CASE WHEN qs.total_attempts > 0 THEN 
            ROUND((qs.correct_count::numeric / qs.total_attempts) * 100, 2) 
            ELSE 0 END,
          'avg_manual_points', COALESCE(qs.avg_manual_points, 0)
        ) ORDER BY qs.id
      ) INTO v_result
      FROM question_stats qs;
      
    ELSE
      RAISE EXCEPTION 'invalid_operation: %', p_operation;
  END CASE;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.attempt_manager(text, uuid, uuid, text, text, inet, jsonb, jsonb, integer, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manager(text, uuid, text, text, text, uuid, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.student_manager(text, text, uuid, uuid, jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.monitoring_manager(text, uuid, interval, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.exam_manager(text, uuid, jsonb, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.results_manager(text, uuid, uuid, uuid, jsonb, jsonb) TO service_role;