CREATE OR REPLACE FUNCTION public.get_store_billing_state(_store_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'plan_id', spa.plan_id,
    'plan_name', COALESCE(spa.custom_plan_name, p.name),
    'plan_slug', p.slug,
    'price', CASE
      WHEN spa.is_free_lifetime THEN 0
      ELSE COALESCE(spa.custom_price, p.price)
    END,
    'currency', p.currency,
    'is_free_lifetime', spa.is_free_lifetime,
    'is_one_time', spa.is_one_time,
    'billing_status', CASE
      WHEN spa.is_free_lifetime THEN 'lifetime'
      WHEN spa.is_one_time AND spa.billing_status <> 'one_time_paid' THEN 'one_time_paid'
      ELSE spa.billing_status
    END,
    'trial_ends_at', CASE WHEN spa.is_free_lifetime OR spa.is_one_time THEN NULL ELSE spa.trial_ends_at END,
    'current_period_end', CASE WHEN spa.is_free_lifetime OR spa.is_one_time THEN NULL ELSE spa.current_period_end END,
    'grace_period_ends_at', CASE WHEN spa.is_free_lifetime OR spa.is_one_time THEN NULL ELSE spa.grace_period_ends_at END,
    'last_payment_at', spa.last_payment_at,
    'is_suspended', CASE
      WHEN spa.is_free_lifetime OR spa.is_one_time THEN false
      ELSE COALESCE(s.is_suspended, false)
    END,
    'days_until_action', CASE
      WHEN spa.is_free_lifetime OR spa.is_one_time THEN NULL
      WHEN spa.billing_status = 'trialing' AND spa.trial_ends_at IS NOT NULL THEN GREATEST(0, EXTRACT(DAY FROM spa.trial_ends_at - now())::int)
      WHEN spa.billing_status = 'active' AND spa.current_period_end IS NOT NULL THEN GREATEST(0, EXTRACT(DAY FROM spa.current_period_end - now())::int)
      WHEN spa.billing_status = 'past_due' AND spa.grace_period_ends_at IS NOT NULL THEN GREATEST(0, EXTRACT(DAY FROM spa.grace_period_ends_at - now())::int)
      ELSE 0
    END,
    'requires_payment', (
      NOT spa.is_free_lifetime
      AND NOT spa.is_one_time
      AND COALESCE(spa.custom_price, p.price) > 0
      AND spa.billing_status IN ('trialing','past_due','suspended')
    )
  ) INTO result
  FROM public.store_plan_assignments spa
  JOIN public.plans p ON p.id = spa.plan_id
  JOIN public.stores s ON s.id = spa.store_id
  WHERE spa.store_id = _store_id
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_billing_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_billing_state(uuid) TO service_role;