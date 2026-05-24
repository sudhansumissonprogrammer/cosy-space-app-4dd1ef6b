
-- Fix: anon (Cloudflare Worker) couldn't insert page_views because the existing
-- INSERT policy's EXISTS subquery on `stores` is filtered by stores RLS for the
-- anon role, returning false. Replace with a SECURITY DEFINER check.

CREATE OR REPLACE FUNCTION public.is_store_active(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND is_suspended = false
  );
$$;

DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;

CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
TO public
WITH CHECK (public.is_store_active(store_id));
