-- Create a specific bucket for Roster files if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('rosters', 'rosters', true) ON CONFLICT (id) DO NOTHING;
-- Policy for public read access
CREATE POLICY "Public Access to Rosters" ON storage.objects FOR
SELECT USING (bucket_id = 'rosters');
-- Policy for authenticated upload
CREATE POLICY "Authenticated users can upload rosters" ON storage.objects FOR
INSERT WITH CHECK (
        bucket_id = 'rosters'
        AND auth.role() = 'authenticated'
    );
-- Table to track uploaded Roster files
CREATE TABLE IF NOT EXISTS public.roster_files (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    month date,
    -- We'll store the first day of the month: '2026-01-01'
    file_url text NOT NULL,
    uploaded_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.roster_files ENABLE ROW LEVEL SECURITY;
-- Policies
CREATE POLICY "View rosters" ON public.roster_files FOR
SELECT USING (true);
CREATE POLICY "Manage rosters" ON public.roster_files FOR ALL USING (auth.role() = 'authenticated');