-- Migration: Add certification columns for special equipment
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cert_golf boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS cert_duplex boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS cert_oruga boolean DEFAULT false;
-- Update assets table to include more statuses
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE public.assets
ADD CONSTRAINT assets_status_check CHECK (
        status IN (
            'available',
            'in_use',
            'maintenance',
            'damaged',
            'lost'
        )
    );
-- Allow agents to report faults (optional: maybe a new table? for now let's just update status)