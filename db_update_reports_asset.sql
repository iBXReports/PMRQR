-- Add asset_code to reports table
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS asset_code text;