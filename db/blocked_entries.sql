-- Create blocked_entries table for the easter egg admin panel
CREATE TABLE IF NOT EXISTS blocked_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('name', 'ip', 'mobile')),
  value TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL,
  UNIQUE(type, value)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_blocked_entries_type_value ON blocked_entries(type, value);
CREATE INDEX IF NOT EXISTS idx_blocked_entries_created_at ON blocked_entries(created_at DESC);

-- Enable RLS
ALTER TABLE blocked_entries ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only
CREATE POLICY "Admin can manage blocked entries" ON blocked_entries
<<<<<<< HEAD
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );
=======
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());
>>>>>>> 0602e4005d295e20267a4bdf4c63a7bc1636e05a

-- Grant permissions
GRANT ALL ON blocked_entries TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;