-- FIX: Allow all authenticated users (Admins/Supervisors) to view ALL operations
-- Previously, users could only see their own operations, hiding them from the Live Monitor.
-- 1. Operations Table
drop policy if exists "Agents can view own operations" on public.operations;
-- Also drop any other conflicting select policies if they exist
drop policy if exists "Authenticated users can view all operations" on public.operations;
create policy "Authenticated users can view all operations" on public.operations for
select using (auth.role() = 'authenticated');
-- 2. Ensure Profiles are also viewable (already set in db_schema.sql but good to double check)
-- "Public profiles are viewable by everyone" should cover this.
-- 3. Ensure Assets are viewable (already set)
-- "Read assets" policy covers this.
-- 4. Just in case, grant permissions if they were missing (from db_schema loop)
grant all on public.operations to authenticated;
grant all on public.assets to authenticated;