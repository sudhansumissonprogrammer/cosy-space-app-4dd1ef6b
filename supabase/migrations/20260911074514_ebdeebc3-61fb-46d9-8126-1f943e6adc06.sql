ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS telegram_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_telegram_paid_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.store_telegram_config c
    WHERE c.store_id = NEW.store_id AND c.is_active AND coalesce(c.chat_id, '') <> ''
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.orders
     SET telegram_notified_at = now()
   WHERE id = NEW.id AND telegram_notified_at IS NULL;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT secret INTO v_secret FROM public.cron_auth LIMIT 1;

  PERFORM net.http_post(
    url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/telegram-order-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('order_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_telegram_paid_order ON public.orders;
CREATE TRIGGER trg_notify_telegram_paid_order
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
WHEN (
  NEW.payment_verified IS TRUE
  AND NEW.telegram_notified_at IS NULL
  AND coalesce(NEW.status, '') NOT IN ('cancelled', 'refunded')
)
EXECUTE FUNCTION public.notify_telegram_paid_order();