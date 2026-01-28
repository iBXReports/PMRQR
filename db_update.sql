-- 1. UPDATE PROFILES (Add Role & Team info)
-- Columns might already exist if you customized, but let's ensure they are there.
alter table public.profiles
add column if not exists role text default 'Agente' check (role in ('Agente', 'CDO', 'Supervisor', 'Jefe')),
    add column if not exists team text check (team in ('OLA', 'LATAM', 'NP'));
-- 2. UPDATE OPERATIONS
-- Add Flight Info columns
alter table public.operations
add column if not exists bridge text,
    -- Puente A, B, C...
add column if not exists flight_number text,
    add column if not exists airline text;
-- 3. UPDATE POLICIES (If needed)
-- (Existing policies cover updates if they own the row)