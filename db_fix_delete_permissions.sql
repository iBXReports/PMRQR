-- 1. Allow DELETE on Operations (Required for cleaning up history)
DROP POLICY IF EXISTS "Authenticated users can delete operations" ON public.operations;
CREATE POLICY "Authenticated users can delete operations" ON public.operations FOR DELETE USING (auth.role() = 'authenticated');
-- 2. Allow DELETE on Assets (Required for removing equipment)
DROP POLICY IF EXISTS "Authenticated users can delete assets" ON public.assets;
CREATE POLICY "Authenticated users can delete assets" ON public.assets FOR DELETE USING (auth.role() = 'authenticated');
-- 3. OPTIONAL BUT RECOMMENDED: Change Foreign Key to CASCADE
-- This automatically deletes history when an asset is deleted, preventing the error.
ALTER TABLE public.operations DROP CONSTRAINT IF EXISTS operations_asset_id_fkey;
ALTER TABLE public.operations
ADD CONSTRAINT operations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets (id) ON DELETE CASCADE;