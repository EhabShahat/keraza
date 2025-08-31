-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the logos bucket
-- NOTE: These policies are temporarily permissive for development
-- TODO: Restrict to admin users only when admin authentication is fully implemented

CREATE POLICY "Public can view logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

-- TEMPORARY: Allow anyone to upload logos (change to admin-only later)
CREATE POLICY "Anyone can upload logos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'logos');

-- TEMPORARY: Allow anyone to update logos (change to admin-only later)  
CREATE POLICY "Anyone can update logos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'logos');

-- TEMPORARY: Allow anyone to delete logos (change to admin-only later)
CREATE POLICY "Anyone can delete logos" ON storage.objects
  FOR DELETE USING (bucket_id = 'logos');

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;