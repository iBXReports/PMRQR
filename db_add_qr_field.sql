-- Migration: Add QR Code URL field to assets
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS qr_url text;
-- Ensure RLS is updated (if you have restrictive policies)
-- The existing Manage assets policy (FOR ALL TO authenticated) should cover this new column automatically.