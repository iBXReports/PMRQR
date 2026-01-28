-- 1. ASSETS TABLE (Wheelchairs, Carts)
create table if not exists public.assets (
    id uuid default gen_random_uuid() primary key,
    code text unique not null,
    -- The QR content, e.g., "SILLA-001"
    type text check (type in ('silla', 'carrito')),
    status text default 'available' check (status in ('available', 'in_use', 'maintenance')),
    created_at timestamp with time zone default timezone('utc'::text, now())
);
-- 2. OPERATIONS TABLE (To track movements)
create table if not exists public.operations (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users not null,
    asset_id uuid references public.assets(id) not null,
    -- Start Data
    start_time timestamp with time zone default timezone('utc'::text, now()),
    start_location_type text,
    -- Terminal Nacional/Internacional
    start_point text,
    -- Counter, Punto, Minsal, etc.
    team text,
    -- OLA, LATAM, NP
    role text,
    -- Agente, CDO, Supervisor
    destination text,
    -- Toward where?
    -- End Data (Nullable initially)
    end_time timestamp with time zone,
    end_location_type text,
    end_point text,
    -- Where it was returned (QR Location)
    status text default 'active' check (status in ('active', 'completed')),
    return_method text default 'qr' check (return_method in ('qr', 'manual')),
    parent_operation_id uuid -- For chaining if needed, though simple update works
);
-- RLS
alter table public.assets enable row level security;
alter table public.operations enable row level security;
-- Policies for Assets
create policy "Read assets" on public.assets for
select using (true);
create policy "Update assets status" on public.assets for
update using (auth.role() = 'authenticated');
-- Policies for Operations
create policy "Agents can create operations" on public.operations for
insert with check (auth.uid() = user_id);
create policy "Agents can view own operations" on public.operations for
select using (auth.uid() = user_id);
create policy "Agents can update own active operations" on public.operations for
update using (auth.uid() = user_id);
-- SEED DATA (Example Assets)
insert into public.assets (code, type)
values ('SILLA-001', 'silla'),
    ('SILLA-002', 'silla'),
    ('CARRITO-001', 'carrito') on conflict (code) do nothing;