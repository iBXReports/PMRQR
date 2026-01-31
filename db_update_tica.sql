ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tica_status text DEFAULT 'no_tiene';