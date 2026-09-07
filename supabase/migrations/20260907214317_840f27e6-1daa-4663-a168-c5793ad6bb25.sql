CREATE OR REPLACE FUNCTION public.get_store_coupon_teaser(_store_id uuid)
 RETURNS TABLE(code text, discount_type text, discount_value numeric, min_order_amount numeric, expires_at timestamp with time zone, starts_at timestamp with time zone, is_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.code, c.discount_type, c.discount_value, c.min_order_amount,
         c.expires_at, c.starts_at, c.is_active
  FROM public.coupons c
  WHERE c.store_id = _store_id
    AND c.is_active = true
    AND COALESCE(c.auto_apply, false) = false
    AND COALESCE(c.wa_exclusive, false) = false
    AND upper(c.code) NOT LIKE 'SPIN%'
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
  ORDER BY c.discount_value DESC
  LIMIT 1
$function$;