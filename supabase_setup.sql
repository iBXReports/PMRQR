-- Enable UUID extension
create extension if not exists "uuid-ossp";
-- Grant usage on schema public (Fix for permission denied)
grant usage on schema public to postgres,
    anon,
    authenticated,
    service_role;
-- Table: Users
create table if not exists public.users (
    id uuid default uuid_generate_v4() primary key,
    username text unique not null,
    password text not null,
    role text not null default 'agente',
    full_name text,
    rut text,
    phone text,
    address text,
    commune text,
    email text,
    agent_type text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Table: Chairs (Assets)
create table if not exists public.chairs (
    id uuid default uuid_generate_v4() primary key,
    code text unique not null,
    category text not null,
    number int not null,
    status text default 'available',
    owner text,
    location text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Table: Movement Logs
create table if not exists public.movement_logs (
    id uuid default uuid_generate_v4() primary key,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id text,
    username text,
    chair_code text,
    origin_text text,
    destination_text text,
    final_location_text text
);
-- Grant access to tables
grant all privileges on all tables in schema public to postgres,
    anon,
    authenticated,
    service_role;
grant all privileges on all sequences in schema public to postgres,
    anon,
    authenticated,
    service_role;
-- Seed Data: Users
insert into public.users (username, password, role, full_name, rut)
values (
        'admin',
        'admin123',
        'admin',
        'Administrador',
        '11.111.111-1'
    ),
    (
        'cm2026',
        'Cargo.2026$',
        'agente',
        'Agente Cargo',
        '22.222.222-2'
    ) on conflict (username) do nothing;
-- RLS Policies (Open access for demo purposes, can be tightened later)
alter table public.users enable row level security;
create policy "Public Access Users" on public.users for all using (true) with check (true);
alter table public.chairs enable row level security;
create policy "Public Access Chairs" on public.chairs for all using (true) with check (true);
alter table public.movement_logs enable row level security;
create policy "Public Access Logs" on public.movement_logs for all using (true) with check (true);