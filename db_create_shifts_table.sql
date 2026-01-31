-- Add RUT to profiles if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
        AND column_name = 'rut'
) THEN
ALTER TABLE public.profiles
ADD COLUMN rut text UNIQUE;
END IF;
END $$;
-- Table to store parsed shifts (User Shifts)
CREATE TABLE IF NOT EXISTS public.user_shifts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    roster_file_id uuid REFERENCES public.roster_files(id) ON DELETE CASCADE,
    rut text,
    -- Link to user via RUT
    user_name text,
    -- Validated name from Excel
    role_raw text,
    -- Cargo from Excel
    team text,
    -- LATAM or OLA
    shift_date date,
    shift_code text,
    -- M0817, etc
    created_at timestamp with time zone DEFAULT now()
);
-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_shifts_date ON public.user_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_user_shifts_rut ON public.user_shifts(rut);
-- RLS
ALTER TABLE public.user_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read shifts" ON public.user_shifts FOR
SELECT USING (true);
CREATE POLICY "Manage shifts" ON public.user_shifts FOR ALL USING (auth.role() = 'authenticated');