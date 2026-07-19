CREATE OR REPLACE FUNCTION public.get_store_payment_config(_store_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'id', id,
    'store_id', store_id,
    'payment_methods', payment_methods,
    'razorpay_key_id', razorpay_key_id,
    'cashfree_app_id', cashfree_app_id,
    'cashfree_env', cashfree_env,
    'payu_merchant_key', payu_merchant_key,
    'payu_env', payu_env,
    'prepaid_discount_enabled', prepaid_discount_enabled,
    'prepaid_discount_type', prepaid_discount_type,
    'prepaid_discount_value', prepaid_discount_value,
    'prepaid_discount_tier2_min', prepaid_discount_tier2_min,
    'prepaid_discount_tier2_value', prepaid_discount_tier2_value,
    'created_at', created_at,
    'updated_at', updated_at
  )
  FROM public.store_payment_config
  WHERE store_id = _store_id
  LIMIT 1;
$function$;