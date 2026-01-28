-- CRITICAL: Grant usage on schema public (Fixes permission denied errors)
grant usage on schema public to anon,
    authenticated,
    service_role;
grant all on all tables in schema public to anon,
    authenticated,
    service_role;
grant all on all sequences in schema public to anon,
    authenticated,
    service_role;
grant all on all routines in schema public to anon,
    authenticated,
    service_role;
-- Grant permissions for storage schema as well if needed
grant usage on schema storage to anon,
    authenticated,
    service_role;
grant all on all tables in schema storage to anon,
    authenticated,
    service_role;
-- 1. PROFILES TABLE
create table if not exists public.profiles (
    id uuid references auth.users not null primary key,
    username text unique,
    full_name text,
    address text,
    commune text,
    phone text,
    avatar_url text,
    updated_at timestamp with time zone default timezone('utc'::text, now()),
    constraint username_length check (char_length(username) >= 3)
);
-- Enable RLS
alter table public.profiles enable row level security;
-- Policies (Drop first to avoid duplicates)
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for
select using (true);
drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for
insert with check (auth.uid() = id);
drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for
update using (auth.uid() = id);
-- 2. TRIGGER FOR NEW USER
create or replace function public.handle_new_user() returns trigger language plpgsql security definer
set search_path = public as $$ begin
insert into public.profiles (id, username, full_name, address, commune, phone)
values (
        new.id,
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'address',
        new.raw_user_meta_data->>'commune',
        new.raw_user_meta_data->>'phone'
    );
return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after
insert on auth.users for each row execute procedure public.handle_new_user();
-- 3. STORAGE SETUP
-- Create bucket "uploads" if not exists
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true) on conflict (id) do nothing;
-- Storage Policies
drop policy if exists "Public Access to Uploads" on storage.objects;
create policy "Public Access to Uploads" on storage.objects for
select using (bucket_id = 'uploads');
drop policy if exists "Authenticated users can upload" on storage.objects;
create policy "Authenticated users can upload" on storage.objects for
insert with check (
        bucket_id = 'uploads'
        and auth.role() = 'authenticated'
    );
-- NEW: Allow Update (for changing profile pictures)
drop policy if exists "Authenticated users can update own uploads" on storage.objects;
create policy "Authenticated users can update own uploads" on storage.objects for
update using (
        bucket_id = 'uploads'
        and auth.uid() = owner
    );
-- 4. APP SETTINGS
create table if not exists public.app_settings (
    key text primary key,
    value text,
    description text
);
alter table public.app_settings enable row level security;
drop policy if exists "Read settings" on public.app_settings;
create policy "Read settings" on public.app_settings for
select using (true);