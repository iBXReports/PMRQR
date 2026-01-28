-- Run this in Supabase SQL Editor to support the new flight details in operations
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS bridge text;
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS gate text;
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS airline text;
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS flight_number text;