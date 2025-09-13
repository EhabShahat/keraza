-- Setup script for Easter Egg blocked entries feature
-- Run this in your Supabase SQL editor

-- Create blocked_entries table
CREATE TABLE IF NOT EXISTS blocked_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('name', 'ip', 'mobile')),
  value TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL,
  UNIQUE(type, value)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocked_entries_type_value ON blocked_entries(type, value);
CREATE INDEX IF NOT EXISTS idx_blocked_entries_created_at ON blocked_entries(created_at DESC);

-- Enable Row Level Security
ALTER TABLE blocked_entries ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only
DROP POLICY IF EXISTS "Admin can manage blocked entries" ON blocked_entries;
CREATE POLICY "Admin can manage blocked entries" ON blocked_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON blocked_entries TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Insert some example blocked entries (optional)
-- INSERT INTO blocked_entries (type, value, reason, created_by) VALUES
-- ('name', 'Test Student', 'Testing purposes', 'system'),
-- ('ip', '192.168.1.100', 'Suspicious activity', 'system');

-- Verify the table was created
SELECT 'blocked_entries table created successfully!' as status;