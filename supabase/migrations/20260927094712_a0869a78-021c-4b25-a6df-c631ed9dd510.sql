CREATE OR REPLACE FUNCTION public.wa_platform_recipient_tier_check(_phone text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'uniq', count(DISTINCT recipient_phone),
    'has_phone', bool_or(recipient_phone = _phone)
  )
  FROM public.whatsapp_messages
  WHERE sent_via = 'platform' AND direction = 'outgoing' AND status = 'sent'
    AND created_at >= now() - interval '24 hours';
$$;
REVOKE ALL ON FUNCTION public.wa_platform_recipient_tier_check(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_platform_recipient_tier_check(text) TO service_role;