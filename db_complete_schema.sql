-- ============================================================================
-- PMRQR - COMPLETE DATABASE SCHEMA
-- Combined from all SQL files
-- Last updated: 2026-01-27
-- ============================================================================
-- ============================================================================
-- SECTION 1: EXTENSIONS & PERMISSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO anon,
    authenticated,
    service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,
    authenticated,
    service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon,
    authenticated,
    service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon,
    authenticated,
    service_role;
GRANT USAGE ON SCHEMA storage TO anon,
    authenticated,
    service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon,
    authenticated,
    service_role;
-- ============================================================================
-- SECTION 2: PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
    username text UNIQUE,
    full_name text,
    email text,
    address text,
    commune text,
    phone text,
    avatar_url text,
    role text DEFAULT 'Agente' CHECK (
        role IN ('Agente', 'CDO', 'Supervisor', 'Jefe', 'admin')
    ),
    team text CHECK (team IN ('OLA', 'LATAM', 'NP')),
    cert_golf boolean DEFAULT false,
    cert_duplex boolean DEFAULT false,
    cert_oruga boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT username_length CHECK (char_length(username) >= 3)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR
SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR
INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR
UPDATE USING (auth.uid() = id);
-- ============================================================================
-- SECTION 3: TRIGGER FOR NEW USER REGISTRATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$ BEGIN
INSERT INTO public.profiles (id, username, full_name, address, commune, phone)
VALUES (
        new.id,
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'address',
        new.raw_user_meta_data->>'commune',
        new.raw_user_meta_data->>'phone'
    );
RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- ============================================================================
-- SECTION 4: ASSETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.assets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE NOT NULL,
    type text,
    status text DEFAULT 'available' CHECK (
        status IN (
            'available',
            'in_use',
            'maintenance',
            'damaged',
            'lost'
        )
    ),
    owner text,
    location text,
    start_link text,
    return_link text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read assets" ON public.assets;
CREATE POLICY "Read assets" ON public.assets FOR
SELECT USING (true);
DROP POLICY IF EXISTS "Update assets status" ON public.assets;
CREATE POLICY "Update assets status" ON public.assets FOR
UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can update assets" ON public.assets;
CREATE POLICY "Authenticated users can update assets" ON public.assets FOR
UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can delete assets" ON public.assets;
CREATE POLICY "Authenticated users can delete assets" ON public.assets FOR DELETE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Manage assets" ON public.assets;
CREATE POLICY "Manage assets" ON public.assets FOR ALL USING (auth.role() = 'authenticated');
-- ============================================================================
-- SECTION 5: OPERATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.operations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users NOT NULL,
    asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
    start_time timestamp with time zone DEFAULT timezone('utc'::text, now()),
    start_location_type text,
    start_point text,
    team text,
    role text,
    destination text,
    end_time timestamp with time zone,
    end_location_type text,
    end_point text,
    end_gate text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    return_method text DEFAULT 'qr' CHECK (return_method IN ('qr', 'manual')),
    parent_operation_id uuid,
    bridge text,
    gate text,
    airline text,
    flight_number text
);
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can create operations" ON public.operations;
CREATE POLICY "Agents can create operations" ON public.operations FOR
INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Agents can view own operations" ON public.operations;
DROP POLICY IF EXISTS "Authenticated users can view all operations" ON public.operations;
CREATE POLICY "Authenticated users can view all operations" ON public.operations FOR
SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Agents can update own active operations" ON public.operations;
CREATE POLICY "Agents can update own active operations" ON public.operations FOR
UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authenticated users can update operations" ON public.operations;
CREATE POLICY "Authenticated users can update operations" ON public.operations FOR
UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can delete operations" ON public.operations;
CREATE POLICY "Authenticated users can delete operations" ON public.operations FOR DELETE USING (auth.role() = 'authenticated');
GRANT ALL ON public.operations TO authenticated;
GRANT ALL ON public.assets TO authenticated;
-- ============================================================================
-- SECTION 6: REPORTS TABLE (Incident Reports)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id),
    report_category text NOT NULL,
    asset_type text NOT NULL,
    asset_code text,
    terminal text NOT NULL,
    location_context text NOT NULL,
    gate text,
    description text,
    photo_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can insert reports" ON public.reports;
CREATE POLICY "Agents can insert reports" ON public.reports FOR
INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports" ON public.reports FOR
SELECT USING (true);
-- ============================================================================
-- SECTION 7: CONFIG TABLES (Airlines, Locations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.airlines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    logo_url text,
    name text NOT NULL,
    iata_code text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read airlines" ON public.airlines;
CREATE POLICY "Read airlines" ON public.airlines FOR
SELECT USING (true);
DROP POLICY IF EXISTS "Manage airlines" ON public.airlines;
CREATE POLICY "Manage airlines" ON public.airlines FOR ALL USING (auth.role() = 'authenticated');
CREATE TABLE IF NOT EXISTS public.locations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    type text NOT NULL CHECK (
        type IN (
            'origin',
            'destination',
            'gate',
            'bridge',
            'gate_arrival',
            'position'
        )
    ),
    terminal text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read locations" ON public.locations;
CREATE POLICY "Read locations" ON public.locations FOR
SELECT USING (true);
DROP POLICY IF EXISTS "Manage locations" ON public.locations;
CREATE POLICY "Manage locations" ON public.locations FOR ALL USING (auth.role() = 'authenticated');
-- ============================================================================
-- SECTION 8: APP SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text,
    description text
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read settings" ON public.app_settings;
CREATE POLICY "Read settings" ON public.app_settings FOR
SELECT USING (true);
-- ============================================================================
-- SECTION 9: STORAGE SETUP
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public Access to Uploads" ON storage.objects;
CREATE POLICY "Public Access to Uploads" ON storage.objects FOR
SELECT USING (bucket_id = 'uploads');
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR
INSERT WITH CHECK (
        bucket_id = 'uploads'
        AND auth.role() = 'authenticated'
    );
DROP POLICY IF EXISTS "Authenticated users can update own uploads" ON storage.objects;
CREATE POLICY "Authenticated users can update own uploads" ON storage.objects FOR
UPDATE USING (
        bucket_id = 'uploads'
        AND auth.uid() = owner
    );
-- ============================================================================
-- SECTION 10: SEED DATA (Optional - Airlines)
-- ============================================================================
INSERT INTO public.airlines (logo_url, name, iata_code)
VALUES (
        'https://logos-world.net/wp-content/uploads/2020/03/LATAM-Logo.png',
        'LATAM',
        'LA'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/11/Delta-Air-Lines-Logo.png',
        'DELTA',
        'DL'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/03/Air-France-Logo.png',
        'AIRFRANCE',
        'AF'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2021/02/Air-Canada-Logo.png',
        'AIR CANADA',
        'AC'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/10/KLM-Logo.png',
        'KLM',
        'KL'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/10/Iberia-Logo.png',
        'IBERIA',
        'IB'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/03/Qantas-Logo.png',
        'QANTAS',
        'QF'
    ),
    (
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/LEVEL_logo.svg/1200px-LEVEL_logo.svg.png',
        'LEVEL',
        'LL'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/03/British-Airways-Logo.png',
        'BRITISH AIRWAYS',
        'BA'
    ),
    (
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Arajet_logo.svg/1200px-Arajet_logo.svg.png',
        'ARAJET',
        'DM'
    ),
    (
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/BOA_Logo.svg/1200px-BOA_Logo.svg.png',
        'BOA',
        'OB'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2020/11/Copa-Airlines-Logo.png',
        'COPA',
        'CM'
    ),
    (
        'https://logos-world.net/wp-content/uploads/2023/01/Aerolineas-Argentinas-Logo.png',
        'AEROLINEAS ARG',
        'AR'
    ) ON CONFLICT DO NOTHING;
INSERT INTO public.locations (name, type, terminal)
VALUES ('Counter', 'origin', null),
    ('Punto Info', 'origin', null),
    ('Minsal', 'origin', null),
    ('Embarque', 'origin', null),
    ('Arribo', 'origin', null),
    ('Estacionamientos', 'origin', null),
    ('Remoto', 'origin', null),
    ('Counters', 'destination', null),
    ('Arribo', 'destination', null),
    ('Embarque', 'destination', null),
    ('Punto', 'destination', null),
    ('Remoto', 'destination', null),
    ('Puente A', 'bridge', 'Nacional'),
    ('Puente B', 'bridge', 'Nacional'),
    ('Puente C', 'bridge', 'Internacional'),
    ('Puente D', 'bridge', 'Internacional'),
    ('Puente E', 'bridge', 'Internacional'),
    ('Puente F', 'bridge', 'Internacional') ON CONFLICT DO NOTHING;
-- ============================================================================
-- END OF SCHEMA
-- ============================================================================