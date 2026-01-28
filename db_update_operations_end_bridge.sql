-- Add end_bridge to operations table
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS end_bridge text;