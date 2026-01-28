-- FIX: Allow UPDATE on Operations and Assets for manual returns
-- Problem: Admins couldn't manually finish operations because RLS only allowed users to update their OWN operations.
-- 1. OPERATIONS: Allow any authenticated user (Admin/Supervisor) to update any operation
DROP POLICY IF EXISTS "Authenticated users can update operations" ON public.operations;
CREATE POLICY "Authenticated users can update operations" ON public.operations FOR
UPDATE USING (auth.role() = 'authenticated');
-- 2. ASSETS: Allow any authenticated user to update asset status (e.g. freeing it manually)
DROP POLICY IF EXISTS "Authenticated users can update assets" ON public.assets;
CREATE POLICY "Authenticated users can update assets" ON public.assets FOR
UPDATE USING (auth.role() = 'authenticated');
-- 3. Ensure Grants are correct (just in case)
GRANT UPDATE ON public.operations TO authenticated;
GRANT UPDATE ON public.assets TO authenticated;