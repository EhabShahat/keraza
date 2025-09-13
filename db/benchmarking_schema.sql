-- Performance Benchmarking Database Schema
-- Tables for storing performance baselines, test results, and regression data

-- Performance baselines table
CREATE TABLE IF NOT EXISTS performance_baselines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metrics JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    description TEXT,
    version VARCHAR(50),
    environment VARCHAR(50) DEFAULT 'production'
);

-- Benchmark test results table
CREATE TABLE IF NOT EXISTS benchmark_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_id VARCHAR(255) NOT NULL,
    test_name VARCHAR(255),
    metrics JSONB NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    errors JSONB,
    duration INTEGER NOT NULL, -- milliseconds
    iterations INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    baseline_id UUID REFERENCES performance_baselines(id),
    environment VARCHAR(50) DEFAULT 'production'
);

-- Load test results table
CREATE TABLE IF NOT EXISTS load_test_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scenario_name VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    failed_requests INTEGER NOT NULL DEFAULT 0,
    average_response_time DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_response_time DECIMAL(10,2) NOT NULL DEFAULT 0,
    min_response_time DECIMAL(10,2) NOT NULL DEFAULT 0,
    throughput DECIMAL(10,2) NOT NULL DEFAULT 0, -- requests per second
    error_rate DECIMAL(5,2) NOT NULL DEFAULT 0, -- percentage
    concurrent_users INTEGER NOT NULL DEFAULT 0,
    resource_utilization JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id)
);

-- Performance regression alerts table
CREATE TABLE IF NOT EXISTS performance_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_id VARCHAR(255) UNIQUE NOT NULL,
    metric VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    current_value DECIMAL(15,4) NOT NULL,
    baseline_value DECIMAL(15,4) NOT NULL,
    degradation DECIMAL(8,2) NOT NULL, -- percentage
    threshold_value DECIMAL(8,2) NOT NULL,
    message TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance metrics history table (for trend analysis)
CREATE TABLE IF NOT EXISTS performance_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time DECIMAL(10,2) NOT NULL DEFAULT 0,
    throughput DECIMAL(10,2) NOT NULL DEFAULT 0,
    error_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    memory_usage DECIMAL(10,2) NOT NULL DEFAULT 0,
    cpu_usage DECIMAL(5,2) NOT NULL DEFAULT 0,
    function_count INTEGER NOT NULL DEFAULT 0,
    cache_hit_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    database_query_time DECIMAL(10,2) NOT NULL DEFAULT 0,
    environment VARCHAR(50) DEFAULT 'production',
    version VARCHAR(50)
);

-- Benchmark test configurations table
CREATE TABLE IF NOT EXISTS benchmark_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_performance_baselines_created_at ON performance_baselines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_baselines_environment ON performance_baselines(environment);

CREATE INDEX IF NOT EXISTS idx_benchmark_results_test_id ON benchmark_results(test_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_created_at ON benchmark_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_baseline_id ON benchmark_results(baseline_id);

CREATE INDEX IF NOT EXISTS idx_load_test_results_scenario ON load_test_results(scenario_name);
CREATE INDEX IF NOT EXISTS idx_load_test_results_created_at ON load_test_results(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved ON performance_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_severity ON performance_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_created_at ON performance_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_history_timestamp ON performance_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_history_environment ON performance_history(environment);

CREATE INDEX IF NOT EXISTS idx_benchmark_configs_active ON benchmark_configs(active);
CREATE INDEX IF NOT EXISTS idx_benchmark_configs_name ON benchmark_configs(name);

-- Create views for easier querying
CREATE OR REPLACE VIEW latest_performance_metrics AS
SELECT 
    timestamp,
    response_time,
    throughput,
    error_rate,
    memory_usage,
    cpu_usage,
    function_count,
    cache_hit_rate,
    database_query_time,
    environment,
    version
FROM performance_history
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

CREATE OR REPLACE VIEW active_performance_alerts AS
SELECT 
    alert_id,
    metric,
    severity,
    current_value,
    baseline_value,
    degradation,
    threshold_value,
    message,
    created_at
FROM performance_alerts
WHERE resolved = false
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
    END,
    created_at DESC;

CREATE OR REPLACE VIEW benchmark_summary AS
SELECT 
    test_id,
    test_name,
    COUNT(*) as total_runs,
    AVG((metrics->>'responseTime')::numeric) as avg_response_time,
    AVG((metrics->>'throughput')::numeric) as avg_throughput,
    AVG((metrics->>'errorRate')::numeric) as avg_error_rate,
    COUNT(*) FILTER (WHERE success = true) as successful_runs,
    COUNT(*) FILTER (WHERE success = false) as failed_runs,
    MAX(created_at) as last_run
FROM benchmark_results
GROUP BY test_id, test_name
ORDER BY last_run DESC;

-- RPC functions for benchmarking operations
CREATE OR REPLACE FUNCTION get_performance_baseline()
RETURNS TABLE (
    id UUID,
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    description TEXT,
    version VARCHAR(50),
    environment VARCHAR(50)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pb.id,
        pb.metrics,
        pb.created_at,
        pb.description,
        pb.version,
        pb.environment
    FROM performance_baselines pb
    ORDER BY pb.created_at DESC
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION store_performance_metrics(
    p_response_time DECIMAL(10,2),
    p_throughput DECIMAL(10,2),
    p_error_rate DECIMAL(5,2),
    p_memory_usage DECIMAL(10,2),
    p_cpu_usage DECIMAL(5,2),
    p_function_count INTEGER,
    p_cache_hit_rate DECIMAL(5,2),
    p_database_query_time DECIMAL(10,2),
    p_environment VARCHAR(50) DEFAULT 'production',
    p_version VARCHAR(50) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO performance_history (
        response_time,
        throughput,
        error_rate,
        memory_usage,
        cpu_usage,
        function_count,
        cache_hit_rate,
        database_query_time,
        environment,
        version
    ) VALUES (
        p_response_time,
        p_throughput,
        p_error_rate,
        p_memory_usage,
        p_cpu_usage,
        p_function_count,
        p_cache_hit_rate,
        p_database_query_time,
        p_environment,
        p_version
    ) RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_performance_trends(
    p_hours INTEGER DEFAULT 24,
    p_environment VARCHAR(50) DEFAULT 'production'
)
RETURNS TABLE (
    hour_bucket TIMESTAMP WITH TIME ZONE,
    avg_response_time DECIMAL(10,2),
    avg_throughput DECIMAL(10,2),
    avg_error_rate DECIMAL(5,2),
    avg_memory_usage DECIMAL(10,2),
    avg_cache_hit_rate DECIMAL(5,2),
    sample_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('hour', ph.timestamp) as hour_bucket,
        AVG(ph.response_time)::DECIMAL(10,2) as avg_response_time,
        AVG(ph.throughput)::DECIMAL(10,2) as avg_throughput,
        AVG(ph.error_rate)::DECIMAL(5,2) as avg_error_rate,
        AVG(ph.memory_usage)::DECIMAL(10,2) as avg_memory_usage,
        AVG(ph.cache_hit_rate)::DECIMAL(5,2) as avg_cache_hit_rate,
        COUNT(*) as sample_count
    FROM performance_history ph
    WHERE ph.timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
        AND ph.environment = p_environment
    GROUP BY date_trunc('hour', ph.timestamp)
    ORDER BY hour_bucket DESC;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_baselines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON benchmark_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON load_test_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON benchmark_configs TO authenticated;

GRANT SELECT ON latest_performance_metrics TO authenticated;
GRANT SELECT ON active_performance_alerts TO authenticated;
GRANT SELECT ON benchmark_summary TO authenticated;

GRANT EXECUTE ON FUNCTION get_performance_baseline() TO authenticated;
GRANT EXECUTE ON FUNCTION store_performance_metrics(DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, INTEGER, DECIMAL, DECIMAL, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_performance_trends(INTEGER, VARCHAR) TO authenticated;