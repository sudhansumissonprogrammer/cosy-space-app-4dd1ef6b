
-- Self-contained cron auth: store a random secret in a service-role-only table,
-- expose a SECURITY DEFINER verifier, and rewrite cron jobs to send it.
-- This removes dependency on app.settings.service_role_key (which is NULL here)
-- and the user-managed *_CRON_SECRET env vars (which the cron has no way to read).

CREATE TABLE IF NOT EXISTS public.cron_auth (
  id boolean PRIMARY KEY DEFAULT true,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cron_auth_singleton CHECK (id = true)
);

GRANT ALL ON public.cron_auth TO service_role;
ALTER TABLE public.cron_auth ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (bypasses RLS) can read.

INSERT INTO public.cron_auth (id, secret)
VALUES (true, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- SECURITY DEFINER verifier: edge functions call this via RPC to validate the header.
CREATE OR REPLACE FUNCTION public.verify_cron_secret(_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cron_auth WHERE secret = _secret
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO anon, authenticated, service_role;

-- Reschedule the three crons to embed the secret literally.
DO $$
DECLARE
  v_secret text;
BEGIN
  SELECT secret INTO v_secret FROM public.cron_auth WHERE id = true;

  PERFORM cron.unschedule('billing-cron-daily');
  PERFORM cron.schedule(
    'billing-cron-daily',
    '15 2 * * *',
    format($cmd$
      select net.http_post(
        url:='https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/billing-cron',
        headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',%L),
        body:='{}'::jsonb
      );
    $cmd$, v_secret)
  );

  PERFORM cron.unschedule('prewarm-cron-15min');
  PERFORM cron.schedule(
    'prewarm-cron-15min',
    '*/15 * * * *',
    format($cmd$
      select net.http_post(
        url:='https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/prewarm-cron',
        headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',%L),
        body:='{}'::jsonb
      );
    $cmd$, v_secret)
  );

  PERFORM cron.unschedule('partner-approve-commissions-daily');
  PERFORM cron.schedule(
    'partner-approve-commissions-daily',
    '30 3 * * *',
    format($cmd$
      select net.http_post(
        url:='https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/partner-approve-commissions',
        headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',%L),
        body:='{}'::jsonb
      );
    $cmd$, v_secret)
  );
END $$;
