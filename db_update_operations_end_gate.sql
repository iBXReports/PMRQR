-- Add end_gate to operations table
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS end_gate text;