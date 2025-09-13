-- Cost Analysis Database Schema
-- Tables for storing cost metrics, baselines, and ROI analysis

-- Cost baselines table
CREATE TABLE IF NOT EXISTS cost_baselines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    breakdown JSONB NOT NULL,
    total_cost DECIMAL(12,6) NOT NULL,
    description TEXT,
    version VARCHAR(50),
    environment VARCHAR(50) DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id)
);

-- Cost metrics table
CREATE TABLE IF NOT EXISTS cost_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    function_invocations INTEGER NOT NULL DEFAULT 0,
    execution_time BIGINT NOT NULL DEFAULT 0, -- milliseconds
    memory_usage DECIMAL(10,2) NOT NULL DEFAULT 0, -- MB-seconds
    bandwidth_usage DECIMAL(10,4) NOT NULL DEFAULT 0, -- GB
    storage_usage DECIMAL(10,4) NOT NULL DEFAULT 0, -- GB
    database_queries INTEGER NOT NULL DEFAULT 0,
    cache_operations INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    environment VARCHAR(50) DEFAULT 'production'
);

-- ROI analysis results table
CREATE TABLE IF NOT EXISTS roi_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    period VARCHAR(50) NOT NULL,
    before_optimization JSONB NOT NULL,
    after_optimization JSONB NOT NULL,
    savings JSONB NOT NULL,
    optimization_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    payback_period DECIMAL(8,2) NOT NULL DEFAULT 0, -- months
    roi_percentage DECIMAL(8,2) NOT NULL DEFAULT 0,
    net_benefit DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id)
);

-- Cost optimization recommendations table
CREATE TABLE IF NOT EXISTS cost_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    description TEXT NOT NULL,
    estimated_savings DECIMAL(10,4) NOT NULL DEFAULT 0,
    implementation_effort VARCHAR(20) NOT NULL CHECK (implementation_effort IN ('low', 'medium', 'high')),
    time_to_implement INTEGER NOT NULL DEFAULT 0, -- days
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
    implemented_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cost projections table
CREATE TABLE IF NOT EXISTS cost_projections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timeframe VARCHAR(20) NOT NULL CHECK (timeframe IN ('monthly', 'quarterly', 'yearly')),
    current_trajectory DECIMAL(12,4) NOT NULL,
    optimized_trajectory DECIMAL(12,4) NOT NULL,
    projected_savings DECIMAL(12,4) NOT NULL,
    confidence_level INTEGER NOT NULL DEFAULT 50 CHECK (confidence_level >= 0 AND confidence_level <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cost_baselines_created_at ON cost_baselines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_baselines_environment ON cost_baselines(environment);

CREATE INDEX IF NOT EXISTS idx_cost_metrics_timestamp ON cost_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_environment ON cost_metrics(environment);

CREATE INDEX IF NOT EXISTS idx_roi_analysis_created_at ON roi_analysis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roi_analysis_period ON roi_analysis(period);

CREATE INDEX IF NOT EXISTS idx_cost_recommendations_priority ON cost_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_cost_recommendations_status ON cost_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_cost_recommendations_category ON cost_recommendations(category);

CREATE INDEX IF NOT EXISTS idx_cost_projections_timeframe ON cost_projections(timeframe);
CREATE INDEX IF NOT EXISTS idx_cost_projections_created_at ON cost_projections(created_at DESC);

-- Create views for easier querying
CREATE OR REPLACE VIEW daily_cost_summary AS
SELECT 
    DATE(timestamp) as date,
    AVG(function_invocations) as avg_function_invocations,
    AVG(execution_time) as avg_execution_time,
    AVG(memory_usage) as avg_memory_usage,
    AVG(bandwidth_usage) as avg_bandwidth_usage,
    AVG(storage_usage) as avg_storage_usage,
    AVG(database_queries) as avg_database_queries,
    AVG(cache_operations) as avg_cache_operations,
    COUNT(*) as sample_count,
    environment
FROM cost_metrics
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp), environment
ORDER BY date DESC;

CREATE OR REPLACE VIEW cost_trends AS
SELECT 
    DATE_TRUNC('week', timestamp) as week,
    AVG(function_invocations) as avg_function_invocations,
    AVG(execution_time) as avg_execution_time,
    AVG(memory_usage) as avg_memory_usage,
    AVG(bandwidth_usage) as avg_bandwidth_usage,
    AVG(storage_usage) as avg_storage_usage,
    AVG(database_queries) as avg_database_queries,
    AVG(cache_operations) as avg_cache_operations,
    environment
FROM cost_metrics
WHERE timestamp >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', timestamp), environment
ORDER BY week DESC;

CREATE OR REPLACE VIEW active_recommendations AS
SELECT 
    category,
    priority,
    description,
    estimated_savings,
    implementation_effort,
    time_to_implement,
    created_at
FROM cost_recommendations
WHERE status = 'pending'
ORDER BY 
    CASE priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
    END,
    estimated_savings DESC;

-- RPC functions for cost analysis operations
CREATE OR REPLACE FUNCTION get_latest_cost_baseline()
RETURNS TABLE (
    id UUID,
    breakdown JSONB,
    total_cost DECIMAL(12,6),
    created_at TIMESTAMP WITH TIME ZONE,
    environment VARCHAR(50)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cb.id,
        cb.breakdown,
        cb.total_cost,
        cb.created_at,
        cb.environment
    FROM cost_baselines cb
    ORDER BY cb.created_at DESC
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_cost_savings(
    p_baseline_cost DECIMAL(12,6),
    p_current_cost DECIMAL(12,6)
)
RETURNS TABLE (
    absolute_savings DECIMAL(12,6),
    percentage_savings DECIMAL(8,2),
    monthly_savings DECIMAL(12,6),
    yearly_savings DECIMAL(12,6)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    abs_savings DECIMAL(12,6);
    pct_savings DECIMAL(8,2);
BEGIN
    abs_savings := p_baseline_cost - p_current_cost;
    pct_savings := CASE 
        WHEN p_baseline_cost > 0 THEN (abs_savings / p_baseline_cost) * 100 
        ELSE 0 
    END;
    
    RETURN QUERY
    SELECT 
        abs_savings,
        pct_savings,
        abs_savings * 30, -- Monthly (assuming daily costs)
        abs_savings * 365; -- Yearly
END;
$$;

CREATE OR REPLACE FUNCTION store_cost_metrics(
    p_function_invocations INTEGER,
    p_execution_time BIGINT,
    p_memory_usage DECIMAL(10,2),
    p_bandwidth_usage DECIMAL(10,4),
    p_storage_usage DECIMAL(10,4),
    p_database_queries INTEGER,
    p_cache_operations INTEGER,
    p_environment VARCHAR(50) DEFAULT 'production'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO cost_metrics (
        function_invocations,
        execution_time,
        memory_usage,
        bandwidth_usage,
        storage_usage,
        database_queries,
        cache_operations,
        environment
    ) VALUES (
        p_function_invocations,
        p_execution_time,
        p_memory_usage,
        p_bandwidth_usage,
        p_storage_usage,
        p_database_queries,
        p_cache_operations,
        p_environment
    ) RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_cost_trend_analysis(
    p_days INTEGER DEFAULT 30,
    p_environment VARCHAR(50) DEFAULT 'production'
)
RETURNS TABLE (
    metric_name VARCHAR(50),
    trend_direction VARCHAR(20),
    trend_percentage DECIMAL(8,2),
    current_avg DECIMAL(12,4),
    previous_avg DECIMAL(12,4)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cutoff_date TIMESTAMP WITH TIME ZONE;
    mid_date TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_date := NOW() - (p_days || ' days')::INTERVAL;
    mid_date := NOW() - (p_days / 2 || ' days')::INTERVAL;
    
    RETURN QUERY
    WITH recent_metrics AS (
        SELECT 
            AVG(function_invocations) as recent_invocations,
            AVG(execution_time) as recent_execution_time,
            AVG(memory_usage) as recent_memory_usage,
            AVG(bandwidth_usage) as recent_bandwidth_usage,
            AVG(database_queries) as recent_database_queries
        FROM cost_metrics
        WHERE timestamp >= mid_date AND environment = p_environment
    ),
    older_metrics AS (
        SELECT 
            AVG(function_invocations) as older_invocations,
            AVG(execution_time) as older_execution_time,
            AVG(memory_usage) as older_memory_usage,
            AVG(bandwidth_usage) as older_bandwidth_usage,
            AVG(database_queries) as older_database_queries
        FROM cost_metrics
        WHERE timestamp >= cutoff_date AND timestamp < mid_date AND environment = p_environment
    )
    SELECT 
        'function_invocations'::VARCHAR(50),
        CASE 
            WHEN r.recent_invocations > o.older_invocations THEN 'increasing'::VARCHAR(20)
            WHEN r.recent_invocations < o.older_invocations THEN 'decreasing'::VARCHAR(20)
            ELSE 'stable'::VARCHAR(20)
        END,
        CASE 
            WHEN o.older_invocations > 0 THEN ((r.recent_invocations - o.older_invocations) / o.older_invocations * 100)::DECIMAL(8,2)
            ELSE 0::DECIMAL(8,2)
        END,
        r.recent_invocations::DECIMAL(12,4),
        o.older_invocations::DECIMAL(12,4)
    FROM recent_metrics r, older_metrics o
    
    UNION ALL
    
    SELECT 
        'execution_time'::VARCHAR(50),
        CASE 
            WHEN r.recent_execution_time > o.older_execution_time THEN 'increasing'::VARCHAR(20)
            WHEN r.recent_execution_time < o.older_execution_time THEN 'decreasing'::VARCHAR(20)
            ELSE 'stable'::VARCHAR(20)
        END,
        CASE 
            WHEN o.older_execution_time > 0 THEN ((r.recent_execution_time - o.older_execution_time) / o.older_execution_time * 100)::DECIMAL(8,2)
            ELSE 0::DECIMAL(8,2)
        END,
        r.recent_execution_time::DECIMAL(12,4),
        o.older_execution_time::DECIMAL(12,4)
    FROM recent_metrics r, older_metrics o;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_baselines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON roi_analysis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_recommendations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_projections TO authenticated;

GRANT SELECT ON daily_cost_summary TO authenticated;
GRANT SELECT ON cost_trends TO authenticated;
GRANT SELECT ON active_recommendations TO authenticated;

GRANT EXECUTE ON FUNCTION get_latest_cost_baseline() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_cost_savings(DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION store_cost_metrics(INTEGER, BIGINT, DECIMAL, DECIMAL, DECIMAL, INTEGER, INTEGER, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cost_trend_analysis(INTEGER, VARCHAR) TO authenticated;