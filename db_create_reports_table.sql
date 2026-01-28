-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id),
    report_category text NOT NULL,
    -- Extraviado, Encontrado, Roto, Dañado, Otro
    asset_type text NOT NULL,
    -- Silla De Pasillo, Silla Oruga, etc.
    terminal text NOT NULL,
    -- Nacional, Internacional
    location_context text NOT NULL,
    -- Origen, Arribos, Embarque
    gate text,
    description text,
    photo_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
-- Policies
CREATE POLICY "Agents can insert reports" ON public.reports FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all reports" ON public.reports FOR
SELECT USING (true);