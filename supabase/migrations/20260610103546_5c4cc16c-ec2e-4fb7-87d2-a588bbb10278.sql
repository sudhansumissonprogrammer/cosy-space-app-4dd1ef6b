
-- 1) Tighten reorder_products: it was created with default PUBLIC EXECUTE.
--    Inner code already checks is_store_owner/has_role, but lock the surface anyway.
REVOKE EXECUTE ON FUNCTION public.reorder_products(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_products(uuid[]) TO authenticated, service_role;

-- 2) Drop our duplicate trigger — a pre-existing trg_order_items_fill_image_url
--    already does the same job. Keep the existing one, drop ours.
DROP TRIGGER IF EXISTS trg_fill_order_item_image ON public.order_items;
DROP FUNCTION IF EXISTS public.fill_order_item_image();
