-- Migration script to add mobile number blocking support to existing databases
-- Run this in your Supabase SQL editor if you already have the blocked_entries table

-- Update the type constraint to include 'mobile'
ALTER TABLE blocked_entries 
DROP CONSTRAINT IF EXISTS blocked_entries_type_check;

ALTER TABLE blocked_entries 
ADD CONSTRAINT blocked_entries_type_check 
CHECK (type IN ('name', 'ip', 'mobile'));

-- The table structure and indexes remain the same
-- No additional columns needed since mobile numbers are stored in the 'value' field

-- Verify the update
SELECT 
  constraint_name, 
  check_clause 
FROM information_schema.check_constraints 
WHERE table_name = 'blocked_entries' 
  AND constraint_name = 'blocked_entries_type_check';