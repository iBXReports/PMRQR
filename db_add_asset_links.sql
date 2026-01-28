-- Migration: Add dynamic links to assets
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS start_link text,
    ADD COLUMN IF NOT EXISTS return_link text;
-- Update existing assets if needed (Optional, the JS can do this on next save too)
-- But let's try to update the type check to include all categories
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_type_check;
-- Note: Categories are dynamic in asset_categories table, so the check constraint might be better removed or widened.