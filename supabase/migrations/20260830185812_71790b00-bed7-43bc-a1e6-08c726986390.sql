CREATE OR REPLACE FUNCTION public.get_award_badge_products(_store_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.products p
  WHERE p.store_id = _store_id
    AND p.award_badge = true
    AND p.is_active = true
$$;

GRANT EXECUTE ON FUNCTION public.get_award_badge_products(uuid) TO anon, authenticated, service_role;