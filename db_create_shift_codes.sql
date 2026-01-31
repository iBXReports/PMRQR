-- Create table for Shift Codes (Role/Turnos)
CREATE TABLE IF NOT EXISTS public.shift_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    -- The code itself: M0517
    start_time time without time zone,
    end_time time without time zone,
    category text,
    -- M, T, N, etc
    type text DEFAULT 'turno',
    -- turno, ausencia, libre, curso
    created_at timestamp with time zone DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.shift_codes ENABLE ROW LEVEL SECURITY;
-- Policies
CREATE POLICY "Read shift codes" ON public.shift_codes FOR
SELECT USING (true);
CREATE POLICY "Manage shift codes" ON public.shift_codes FOR ALL USING (auth.role() = 'authenticated');