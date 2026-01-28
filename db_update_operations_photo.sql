-- Add return_photo_url to operations table
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS return_photo_url text;