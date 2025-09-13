-- Cache entries table for database-tier caching
-- This table stores cache entries with TTL and tag-based invalidation support

CREATE TABLE IF NOT EXISTS cache_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    tags TEXT[] DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_entries_tags ON cache_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_cache_entries_created_at ON cache_entries(created_at);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_cache_entry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamps
DROP TRIGGER IF EXISTS trigger_update_cache_entry_timestamp ON cache_entries;
CREATE TRIGGER trigger_update_cache_entry_timestamp
    BEFORE UPDATE ON cache_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_cache_entry_timestamp();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_entries 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_statistics()
RETURNS TABLE (
    total_entries BIGINT,
    expired_entries BIGINT,
    total_size_mb NUMERIC,
    avg_access_count NUMERIC,
    most_accessed_keys TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_entries,
        ROUND(
            (pg_total_relation_size('cache_entries')::NUMERIC / 1024 / 1024), 2
        ) as total_size_mb,
        ROUND(AVG(access_count), 2) as avg_access_count,
        ARRAY(
            SELECT key 
            FROM cache_entries 
            WHERE expires_at >= NOW()
            ORDER BY access_count DESC 
            LIMIT 10
        ) as most_accessed_keys
    FROM cache_entries;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate cache by tags
CREATE OR REPLACE FUNCTION invalidate_cache_by_tags(tag_list TEXT[])
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_entries 
    WHERE tags && tag_list;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update access statistics
CREATE OR REPLACE FUNCTION update_cache_access(cache_key TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE cache_entries 
    SET 
        access_count = access_count + 1,
        last_accessed = NOW()
    WHERE key = cache_key;
END;
$$ LANGUAGE plpgsql;

-- RLS policies for cache entries (if needed)
ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage cache entries
CREATE POLICY "Service role can manage cache entries" ON cache_entries
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read cache entries (if needed for client-side caching)
CREATE POLICY "Authenticated users can read cache entries" ON cache_entries
    FOR SELECT USING (auth.role() = 'authenticated');

-- Scheduled cleanup job (if supported by your Supabase setup)
-- This would typically be set up as a cron job or scheduled function
COMMENT ON FUNCTION cleanup_expired_cache_entries() IS 
'Function to clean up expired cache entries. Should be called periodically via cron job or scheduled function.';

-- Performance monitoring view
CREATE OR REPLACE VIEW cache_performance AS
SELECT 
    key,
    access_count,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as age_hours,
    EXTRACT(EPOCH FROM (expires_at - NOW())) / 3600 as ttl_remaining_hours,
    tags,
    pg_size_pretty(pg_column_size(data)) as data_size
FROM cache_entries
WHERE expires_at >= NOW()
ORDER BY access_count DESC;

COMMENT ON VIEW cache_performance IS 
'View for monitoring cache performance and identifying hot cache entries';