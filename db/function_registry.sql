-- Function Registry Schema for tracking consolidation progress
-- This schema supports the netlify-functions-optimization project

-- Function Registry table to track all API functions
CREATE TABLE IF NOT EXISTS function_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    original_path TEXT NOT NULL,
    current_path TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('admin', 'public', 'attempts', 'auth', 'utility')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'migrated', 'consolidated')),
    consolidation_target VARCHAR(255), -- Target consolidated handler name
    http_methods TEXT[] NOT NULL DEFAULT '{}',
    dependencies TEXT[] NOT NULL DEFAULT '{}',
    estimated_complexity VARCHAR(20) NOT NULL CHECK (estimated_complexity IN ('low', 'medium', 'high')),
    consolidation_candidate BOOLEAN NOT NULL DEFAULT false,
    file_size INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    migrated_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Function Metrics table for performance tracking
CREATE TABLE IF NOT EXISTS function_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id UUID NOT NULL REFERENCES function_registry(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invocations INTEGER NOT NULL DEFAULT 0,
    avg_duration_ms DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_duration_ms DECIMAL(10,2) NOT NULL DEFAULT 0,
    min_duration_ms DECIMAL(10,2) NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    memory_usage_mb DECIMAL(10,2) NOT NULL DEFAULT 0,
    cpu_usage_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    cache_hit_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    throughput_rpm DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- Consolidation Progress table to track optimization efforts
CREATE TABLE IF NOT EXISTS consolidation_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consolidation_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    target_handler_path TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'testing', 'deployed', 'completed', 'failed')),
    functions_count INTEGER NOT NULL DEFAULT 0,
    functions_migrated INTEGER NOT NULL DEFAULT 0,
    estimated_savings INTEGER NOT NULL DEFAULT 0, -- Number of functions eliminated
    actual_savings INTEGER NOT NULL DEFAULT 0,
    performance_improvement_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Performance Baselines table for tracking optimization impact
CREATE TABLE IF NOT EXISTS performance_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_type VARCHAR(50) NOT NULL CHECK (baseline_type IN ('initial', 'milestone', 'final')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_functions INTEGER NOT NULL,
    avg_response_time_ms DECIMAL(10,2) NOT NULL,
    memory_usage_mb DECIMAL(10,2) NOT NULL,
    error_rate_percent DECIMAL(5,2) NOT NULL,
    throughput_rpm DECIMAL(10,2) NOT NULL,
    consolidation_potential_percent DECIMAL(5,2) NOT NULL,
    cost_estimate_monthly DECIMAL(10,2),
    notes TEXT
);

-- Optimization Recommendations table
CREATE TABLE IF NOT EXISTS optimization_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN ('consolidation', 'caching', 'edge_computing', 'database_optimization')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    estimated_impact VARCHAR(20) NOT NULL CHECK (estimated_impact IN ('low', 'medium', 'high')),
    estimated_effort VARCHAR(20) NOT NULL CHECK (estimated_effort IN ('low', 'medium', 'high')),
    functions_affected TEXT[], -- Array of function IDs or names
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_function_registry_category ON function_registry(category);
CREATE INDEX IF NOT EXISTS idx_function_registry_status ON function_registry(status);
CREATE INDEX IF NOT EXISTS idx_function_registry_consolidation_candidate ON function_registry(consolidation_candidate);
CREATE INDEX IF NOT EXISTS idx_function_metrics_function_id ON function_metrics(function_id);
CREATE INDEX IF NOT EXISTS idx_function_metrics_timestamp ON function_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_consolidation_progress_status ON consolidation_progress(status);
CREATE INDEX IF NOT EXISTS idx_performance_baselines_timestamp ON performance_baselines(timestamp);
CREATE INDEX IF NOT EXISTS idx_optimization_recommendations_priority ON optimization_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_optimization_recommendations_status ON optimization_recommendations(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_function_registry_updated_at 
    BEFORE UPDATE ON function_registry 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consolidation_progress_updated_at 
    BEFORE UPDATE ON consolidation_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_optimization_recommendations_updated_at 
    BEFORE UPDATE ON optimization_recommendations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RPC Functions for function registry operations

-- Register a new function in the registry
CREATE OR REPLACE FUNCTION register_function(
    p_name VARCHAR(255),
    p_original_path TEXT,
    p_category VARCHAR(50),
    p_http_methods TEXT[],
    p_dependencies TEXT[],
    p_estimated_complexity VARCHAR(20),
    p_consolidation_candidate BOOLEAN,
    p_file_size INTEGER
)
RETURNS UUID AS $$
DECLARE
    function_id UUID;
BEGIN
    INSERT INTO function_registry (
        name, original_path, current_path, category, http_methods, 
        dependencies, estimated_complexity, consolidation_candidate, file_size
    ) VALUES (
        p_name, p_original_path, p_original_path, p_category, p_http_methods,
        p_dependencies, p_estimated_complexity, p_consolidation_candidate, p_file_size
    ) RETURNING id INTO function_id;
    
    RETURN function_id;
END;
$$ LANGUAGE plpgsql;

-- Update function metrics
CREATE OR REPLACE FUNCTION update_function_metrics(
    p_function_name VARCHAR(255),
    p_invocations INTEGER,
    p_avg_duration_ms DECIMAL(10,2),
    p_max_duration_ms DECIMAL(10,2),
    p_min_duration_ms DECIMAL(10,2),
    p_error_count INTEGER,
    p_success_count INTEGER,
    p_memory_usage_mb DECIMAL(10,2),
    p_throughput_rpm DECIMAL(10,2)
)
RETURNS VOID AS $$
DECLARE
    function_id UUID;
BEGIN
    -- Get function ID
    SELECT id INTO function_id FROM function_registry WHERE name = p_function_name;
    
    IF function_id IS NULL THEN
        RAISE EXCEPTION 'Function % not found in registry', p_function_name;
    END IF;
    
    -- Insert new metrics record
    INSERT INTO function_metrics (
        function_id, invocations, avg_duration_ms, max_duration_ms, min_duration_ms,
        error_count, success_count, memory_usage_mb, throughput_rpm
    ) VALUES (
        function_id, p_invocations, p_avg_duration_ms, p_max_duration_ms, p_min_duration_ms,
        p_error_count, p_success_count, p_memory_usage_mb, p_throughput_rpm
    );
END;
$$ LANGUAGE plpgsql;

-- Get consolidation candidates by category
CREATE OR REPLACE FUNCTION get_consolidation_candidates(p_category VARCHAR(50) DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    original_path TEXT,
    category VARCHAR(50),
    http_methods TEXT[],
    dependencies TEXT[],
    estimated_complexity VARCHAR(20),
    file_size INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.id, fr.name, fr.original_path, fr.category, fr.http_methods,
        fr.dependencies, fr.estimated_complexity, fr.file_size
    FROM function_registry fr
    WHERE fr.consolidation_candidate = true
    AND fr.status = 'active'
    AND (p_category IS NULL OR fr.category = p_category)
    ORDER BY fr.category, fr.estimated_complexity DESC;
END;
$$ LANGUAGE plpgsql;

-- Create consolidation plan
CREATE OR REPLACE FUNCTION create_consolidation_plan(
    p_consolidation_name VARCHAR(255),
    p_category VARCHAR(50),
    p_target_handler_path TEXT,
    p_function_names TEXT[]
)
RETURNS UUID AS $$
DECLARE
    plan_id UUID;
    functions_count INTEGER;
BEGIN
    -- Count functions to be consolidated
    SELECT COUNT(*) INTO functions_count 
    FROM function_registry 
    WHERE name = ANY(p_function_names) AND status = 'active';
    
    -- Create consolidation plan
    INSERT INTO consolidation_progress (
        consolidation_name, category, target_handler_path, 
        functions_count, estimated_savings
    ) VALUES (
        p_consolidation_name, p_category, p_target_handler_path,
        functions_count, functions_count - 1
    ) RETURNING id INTO plan_id;
    
    -- Mark functions as part of consolidation
    UPDATE function_registry 
    SET consolidation_target = p_consolidation_name,
        status = 'deprecated'
    WHERE name = ANY(p_function_names) AND status = 'active';
    
    RETURN plan_id;
END;
$$ LANGUAGE plpgsql;

-- Record performance baseline
CREATE OR REPLACE FUNCTION record_performance_baseline(
    p_baseline_type VARCHAR(50),
    p_total_functions INTEGER,
    p_avg_response_time_ms DECIMAL(10,2),
    p_memory_usage_mb DECIMAL(10,2),
    p_error_rate_percent DECIMAL(5,2),
    p_throughput_rpm DECIMAL(10,2),
    p_consolidation_potential_percent DECIMAL(5,2),
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    baseline_id UUID;
BEGIN
    INSERT INTO performance_baselines (
        baseline_type, total_functions, avg_response_time_ms, memory_usage_mb,
        error_rate_percent, throughput_rpm, consolidation_potential_percent, notes
    ) VALUES (
        p_baseline_type, p_total_functions, p_avg_response_time_ms, p_memory_usage_mb,
        p_error_rate_percent, p_throughput_rpm, p_consolidation_potential_percent, p_notes
    ) RETURNING id INTO baseline_id;
    
    RETURN baseline_id;
END;
$$ LANGUAGE plpgsql;

-- Get optimization dashboard data
CREATE OR REPLACE FUNCTION get_optimization_dashboard()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_functions', (SELECT COUNT(*) FROM function_registry WHERE status = 'active'),
        'consolidated_functions', (SELECT COUNT(*) FROM function_registry WHERE status IN ('migrated', 'consolidated')),
        'consolidation_candidates', (SELECT COUNT(*) FROM function_registry WHERE consolidation_candidate = true AND status = 'active'),
        'active_consolidations', (SELECT COUNT(*) FROM consolidation_progress WHERE status IN ('planned', 'in_progress', 'testing')),
        'completed_consolidations', (SELECT COUNT(*) FROM consolidation_progress WHERE status = 'completed'),
        'total_savings', (SELECT COALESCE(SUM(actual_savings), 0) FROM consolidation_progress WHERE status = 'completed'),
        'categories', (
            SELECT json_object_agg(category, count)
            FROM (
                SELECT category, COUNT(*) as count
                FROM function_registry 
                WHERE status = 'active'
                GROUP BY category
            ) cat_counts
        ),
        'latest_baseline', (
            SELECT json_build_object(
                'timestamp', timestamp,
                'total_functions', total_functions,
                'avg_response_time_ms', avg_response_time_ms,
                'memory_usage_mb', memory_usage_mb,
                'error_rate_percent', error_rate_percent
            )
            FROM performance_baselines
            ORDER BY timestamp DESC
            LIMIT 1
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;