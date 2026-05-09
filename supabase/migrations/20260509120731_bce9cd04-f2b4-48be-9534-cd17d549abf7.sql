-- 1) Drop redundant AFTER-INSERT referral linker (BEFORE-INSERT version does the same job + sets stores.referred_by_partner_id)
DROP TRIGGER IF EXISTS trg_link_referral_to_store ON public.stores;
DROP FUNCTION IF EXISTS public.tg_link_referral_to_store();

-- 2) Fix refund trigger — partner_clawbacks table no longer exists. Reverse pending/approved commissions; for already-paid commissions, just notify the partner so admin can adjust manually.
CREATE OR REPLACE FUNCTION public.tg_subscription_payment_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.partner_commissions%ROWTYPE;
BEGIN
  IF NEW.status = 'refunded' AND COALESCE(OLD.status,'') <> 'refunded' THEN
    SELECT * INTO c FROM public.partner_commissions WHERE payment_id = NEW.id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    IF c.status IN ('pending','approved') THEN
      PERFORM public.wallet_reverse_commission(c.id);
    ELSIF c.status = 'paid' THEN
      -- Already paid out — log audit + notify; admin handles recovery via wallet_adjust
      PERFORM public.log_partner_audit(
        'commission_clawback_needed', 'commission', c.id, NULL,
        jsonb_build_object('commission_id', c.id, 'amount', c.commission_amount, 'payment_id', NEW.id),
        'Customer refunded a payment whose commission was already paid out'
      );
      PERFORM public._notify_partner(
        c.partner_id, 'commission_clawback',
        'Commission clawback notice: ₹' || c.commission_amount::text,
        'A previously paid commission was refunded by the customer. Our team will contact you for recovery.',
        jsonb_build_object('commission_id', c.id, 'amount', c.commission_amount)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Retention cleanup function for unbounded tables
CREATE OR REPLACE FUNCTION public.cleanup_referral_telemetry()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _clicks_deleted int;
  _webhooks_deleted int;
BEGIN
  WITH d AS (
    DELETE FROM public.partner_referral_clicks
    WHERE created_at < now() - INTERVAL '90 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO _clicks_deleted FROM d;

  WITH d AS (
    DELETE FROM public.webhook_events
    WHERE created_at < now() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO _webhooks_deleted FROM d;

  RETURN json_build_object(
    'clicks_deleted', _clicks_deleted,
    'webhook_events_deleted', _webhooks_deleted,
    'ran_at', now()
  );
END;
$function$;