-- Add foreign key relationship between operations.user_id and public.profiles.id
-- This allows Supabase to "see" the relationship for joins.
alter table public.operations drop constraint if exists operations_user_id_fkey;
-- We reference public.profiles instead of auth.users for the join to work easily in the client
-- (Since auth.users is protected and often harder to join directly in client queries without views)
-- However, profiles.id IS referencing auth.users, so it's a 1:1 mapping.
alter table public.operations
add constraint operations_user_id_fkey_profiles foreign key (user_id) references public.profiles (id);