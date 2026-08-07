CREATE TABLE public.wa_marketing_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone text NOT NULL,
  message_type text NOT NULL,
  source text NOT NULL DEFAULT 'platform',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.wa_marketing_attempts TO service_role;

ALTER TABLE public.wa_marketing_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX wa_marketing_attempts_phone_created_idx
  ON public.wa_marketing_attempts (recipient_phone, created_at DESC);

INSERT INTO public.wa_marketing_attempts (recipient_phone, message_type, source, created_at)
SELECT regexp_replace(recipient_phone, '\D', '', 'g'),
       COALESCE(message_type, 'platform'),
       'historical_backfill',
       created_at
FROM public.whatsapp_messages
WHERE direction = 'outgoing'
  AND sent_via = 'platform'
  AND created_at >= now() - interval '7 days'
  AND COALESCE(message_type, '') NOT IN (
    'order_confirmation', 'payment_received', 'payment_success',
    'order_shipped', 'order_delivered', 'text_reply'
  );

CREATE OR REPLACE FUNCTION public.claim_wa_marketing_attempt(
  _recipient_phone text,
  _message_type text,
  _source text DEFAULT 'platform',
  _limit integer DEFAULT 3
)
RETURNS TABLE(allowed boolean, attempts_in_window integer, claim_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := regexp_replace(COALESCE(_recipient_phone, ''), '\D', '', 'g');
  v_count integer;
  v_id uuid;
BEGIN
  IF v_phone = '' OR _limit < 1 THEN
    RETURN QUERY SELECT false, 0, NULL::uuid;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('wa-marketing:' || v_phone, 0));

  DELETE FROM public.wa_marketing_attempts
  WHERE recipient_phone = v_phone
    AND created_at < now() - interval '8 days';

  SELECT count(*)::integer INTO v_count
  FROM public.wa_marketing_attempts
  WHERE recipient_phone = v_phone
    AND created_at >= now() - interval '7 days';

  IF v_count >= _limit THEN
    RETURN QUERY SELECT false, v_count, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.wa_marketing_attempts (recipient_phone, message_type, source)
  VALUES (v_phone, COALESCE(NULLIF(_message_type, ''), 'platform'), COALESCE(NULLIF(_source, ''), 'platform'))
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_count + 1, v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_wa_marketing_attempt(text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wa_marketing_attempt(text, text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.release_wa_marketing_attempt(_claim_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.wa_marketing_attempts WHERE id = _claim_id;
$$;

REVOKE ALL ON FUNCTION public.release_wa_marketing_attempt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_wa_marketing_attempt(uuid) TO service_role;

UPDATE public.wa_send_queue
SET status = 'pending',
    locked_until = NULL,
    scheduled_at = now(),
    last_error = 'recovered_expired_worker_lock',
    updated_at = now()
WHERE status = 'sending'
  AND locked_until < now();