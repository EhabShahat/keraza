-- Real-time RPC functions for attempt management
-- These functions support the real-time attempt features

-- Function to get real-time attempt synchronization status
CREATE OR REPLACE FUNCTION public.get_attempt_sync_status(p_attempt_id uuid)
RETURNS TABLE(
  attempt_id uuid,
  current_version integer,
  last_sync_time timestamptz,
  pending_changes integer,
  sync_conflicts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ea.id as attempt_id,
    ea.version as current_version,
    ea.updated_at as last_sync_time,
    COALESCE(
      (SELECT COUNT(*)::integer 
       FROM public.attempt_activity_events aae 
       WHERE aae.attempt_id = ea.id 
         AND aae.event_type = 'pending_change'
         AND aae.created_at > ea.updated_at
      ), 0
    ) as pending_changes,
    COALESCE(ea.auto_save_data->'sync_conflicts', '[]'::jsonb) as sync_conflicts
  FROM public.exam_attempts ea
  WHERE ea.id = p_attempt_id
    AND ea.completion_status = 'in_progress';
END;
$function$;

-- Function to batch update attempt versions for conflict resolution
CREATE OR REPLACE FUNCTION public.batch_resolve_attempt_conflicts(
  p_resolutions jsonb
)
RETURNS TABLE(
  attempt_id uuid,
  success boolean,
  new_version integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  resolution_item jsonb;
  current_attempt_id uuid;
  current_answers jsonb;
  current_version integer;
  resolved_answers jsonb;
BEGIN
  -- Process each resolution in the batch
  FOR resolution_item IN SELECT * FROM jsonb_array_elements(p_resolutions)
  LOOP
    BEGIN
      current_attempt_id := (resolution_item->>'attempt_id')::uuid;
      resolved_answers := resolution_item->'resolved_answers';
      
      -- Get current state
      SELECT ea.answers, ea.version 
      INTO current_answers, current_version
      FROM public.exam_attempts ea
      WHERE ea.id = current_attempt_id
        AND ea.completion_status = 'in_progress';
      
      IF NOT FOUND THEN
        RETURN QUERY SELECT 
          current_attempt_id,
          false,
          0,
          'Attempt not found or already submitted'::text;
        CONTINUE;
      END IF;
      
      -- Merge resolved answers with current answers
      current_answers := current_answers || resolved_answers;
      
      -- Update attempt with resolved conflicts
      UPDATE public.exam_attempts 
      SET 
        answers = current_answers,
        version = current_version + 1,
        updated_at = NOW(),
        auto_save_data = auto_save_data - 'sync_conflicts'
      WHERE id = current_attempt_id;
      
      -- Log conflict resolution
      INSERT INTO public.attempt_activity_events (
        attempt_id, 
        event_type, 
        event_time, 
        payload
      ) VALUES (
        current_attempt_id,
        'conflict_resolved',
        NOW(),
        jsonb_build_object(
          'resolved_questions', jsonb_object_keys(resolved_answers),
          'resolution_strategy', resolution_item->>'strategy',
          'previous_version', current_version,
          'new_version', current_version + 1
        )
      );
      
      RETURN QUERY SELECT 
        current_attempt_id,
        true,
        current_version + 1,
        null::text;
        
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        current_attempt_id,
        false,
        current_version,
        SQLERRM::text;
    END;
  END LOOP;
END;
$function$;

-- Function to get real-time attempt activity feed
CREATE OR REPLACE FUNCTION public.get_realtime_attempt_activity(
  p_exam_id uuid DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  attempt_id uuid,
  exam_id uuid,
  student_name text,
  event_type text,
  event_time timestamptz,
  payload jsonb,
  ip_address inet
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    aae.attempt_id,
    ea.exam_id,
    ea.student_name,
    aae.event_type,
    aae.event_time,
    aae.payload,
    ea.ip_address
  FROM public.attempt_activity_events aae
  JOIN public.exam_attempts ea ON ea.id = aae.attempt_id
  WHERE (p_exam_id IS NULL OR ea.exam_id = p_exam_id)
    AND (p_since IS NULL OR aae.event_time > p_since)
    AND aae.event_type IN (
      'realtime_activity', 'auto_save_success', 'auto_save_error',
      'sync_complete', 'sync_error', 'conflict_resolved', 'force_sync'
    )
  ORDER BY aae.event_time DESC
  LIMIT p_limit;
END;
$function$;

-- Function to update attempt heartbeat for connection tracking
CREATE OR REPLACE FUNCTION public.update_attempt_heartbeat(
  p_attempt_id uuid,
  p_connection_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update the attempt's last activity time
  UPDATE public.exam_attempts 
  SET updated_at = NOW()
  WHERE id = p_attempt_id
    AND completion_status = 'in_progress';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Log heartbeat activity
  INSERT INTO public.attempt_activity_events (
    attempt_id, 
    event_type, 
    event_time, 
    payload
  ) VALUES (
    p_attempt_id,
    'heartbeat',
    NOW(),
    jsonb_build_object(
      'connection_id', COALESCE(p_connection_id, 'unknown'),
      'timestamp', extract(epoch from NOW())
    )
  );
  
  RETURN true;
END;
$function$;

-- Function to get attempt connection statistics
CREATE OR REPLACE FUNCTION public.get_attempt_connection_stats(
  p_exam_id uuid DEFAULT NULL
)
RETURNS TABLE(
  total_active_attempts integer,
  total_connections integer,
  avg_session_duration_minutes numeric,
  recent_activity_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ea.id)::integer as total_active_attempts,
    COUNT(DISTINCT aae.payload->>'connection_id')::integer as total_connections,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (NOW() - ea.started_at)) / 60)::numeric(10,2),
      0
    ) as avg_session_duration_minutes,
    COUNT(CASE WHEN aae.event_time > NOW() - INTERVAL '5 minutes' THEN 1 END)::integer as recent_activity_count
  FROM public.exam_attempts ea
  LEFT JOIN public.attempt_activity_events aae ON aae.attempt_id = ea.id
  WHERE ea.completion_status = 'in_progress'
    AND (p_exam_id IS NULL OR ea.exam_id = p_exam_id)
    AND ea.started_at > NOW() - INTERVAL '24 hours';
END;
$function$;

-- Function to cleanup stale connections and attempts
CREATE OR REPLACE FUNCTION public.cleanup_stale_attempt_connections(
  p_timeout_minutes integer DEFAULT 60
)
RETURNS TABLE(
  cleaned_attempts integer,
  cleaned_connections integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stale_cutoff timestamptz;
  cleaned_attempt_count integer := 0;
  cleaned_connection_count integer := 0;
BEGIN
  stale_cutoff := NOW() - (p_timeout_minutes || ' minutes')::interval;
  
  -- Mark attempts as abandoned if no activity for timeout period
  UPDATE public.exam_attempts 
  SET 
    completion_status = 'abandoned',
    auto_save_data = auto_save_data || jsonb_build_object(
      'abandoned_at', NOW(),
      'reason', 'connection_timeout'
    )
  WHERE completion_status = 'in_progress'
    AND updated_at < stale_cutoff;
  
  GET DIAGNOSTICS cleaned_attempt_count = ROW_COUNT;
  
  -- Clean up old activity events (keep last 1000 per attempt)
  WITH ranked_events AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY attempt_id ORDER BY event_time DESC) as rn
    FROM public.attempt_activity_events
  )
  DELETE FROM public.attempt_activity_events
  WHERE id IN (
    SELECT id FROM ranked_events WHERE rn > 1000
  );
  
  GET DIAGNOSTICS cleaned_connection_count = ROW_COUNT;
  
  RETURN QUERY SELECT cleaned_attempt_count, cleaned_connection_count;
END;
$function$;

-- Function to get real-time performance metrics
CREATE OR REPLACE FUNCTION public.get_realtime_performance_metrics(
  p_time_window_minutes integer DEFAULT 60
)
RETURNS TABLE(
  metric_name text,
  metric_value numeric,
  metric_unit text,
  calculated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  time_cutoff timestamptz;
BEGIN
  time_cutoff := NOW() - (p_time_window_minutes || ' minutes')::interval;
  
  -- Auto-save success rate
  RETURN QUERY
  SELECT 
    'auto_save_success_rate'::text,
    CASE 
      WHEN COUNT(*) > 0 THEN
        (COUNT(CASE WHEN payload->>'type' = 'auto_save_success' THEN 1 END) * 100.0 / 
         COUNT(CASE WHEN payload->>'type' IN ('auto_save_success', 'auto_save_error') THEN 1 END))
      ELSE 0
    END,
    'percentage'::text,
    NOW()
  FROM public.attempt_activity_events
  WHERE event_time > time_cutoff
    AND event_type = 'realtime_activity'
    AND payload->>'type' IN ('auto_save_success', 'auto_save_error');
  
  -- Average sync latency
  RETURN QUERY
  SELECT 
    'avg_sync_latency'::text,
    COALESCE(AVG((payload->>'latency')::numeric), 0),
    'milliseconds'::text,
    NOW()
  FROM public.attempt_activity_events
  WHERE event_time > time_cutoff
    AND event_type = 'realtime_activity'
    AND payload->>'type' IN ('auto_save_success', 'sync_complete')
    AND payload->>'latency' IS NOT NULL;
  
  -- Conflict resolution rate
  RETURN QUERY
  SELECT 
    'conflict_resolution_rate'::text,
    COUNT(*)::numeric,
    'per_hour'::text,
    NOW()
  FROM public.attempt_activity_events
  WHERE event_time > time_cutoff
    AND event_type = 'conflict_resolved';
  
  -- Active connection count
  RETURN QUERY
  SELECT 
    'active_connections'::text,
    COUNT(DISTINCT payload->>'connection_id')::numeric,
    'connections'::text,
    NOW()
  FROM public.attempt_activity_events
  WHERE event_time > NOW() - INTERVAL '5 minutes'
    AND event_type = 'heartbeat';
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_attempt_sync_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.batch_resolve_attempt_conflicts(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_realtime_attempt_activity(uuid, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_attempt_heartbeat(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_attempt_connection_stats(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_attempt_connections(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_realtime_performance_metrics(integer) TO service_role;