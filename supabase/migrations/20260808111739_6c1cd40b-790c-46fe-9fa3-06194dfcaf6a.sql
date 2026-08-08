CREATE TABLE IF NOT EXISTS public.uptime_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_key text NOT NULL UNIQUE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'storefront',
  method text NOT NULL DEFAULT 'GET',
  enabled boolean NOT NULL DEFAULT true,
  expect_status integer NOT NULL DEFAULT 200,
  expect_text text,
  timeout_ms integer NOT NULL DEFAULT 12000,
  state text NOT NULL DEFAULT 'up',
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  last_status integer,
  last_latency_ms integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.uptime_checks (
  id bigserial PRIMARY KEY,
  target_id uuid NOT NULL REFERENCES public.uptime_targets(id) ON DELETE CASCADE,
  ok boolean NOT NULL,
  status_code integer,
  latency_ms integer,
  error text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_target_time ON public.uptime_checks(target_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.uptime_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES public.uptime_targets(id) ON DELETE CASCADE,
  label text,
  url text,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  last_error text,
  checks_failed integer,
  alerted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_uptime_incidents_open ON public.uptime_incidents(target_id, resolved_at);

CREATE TABLE IF NOT EXISTS public.uptime_alert_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  label text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.uptime_targets TO authenticated;
GRANT SELECT ON public.uptime_checks TO authenticated;
GRANT SELECT ON public.uptime_incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uptime_alert_recipients TO authenticated;
GRANT ALL ON public.uptime_targets TO service_role;
GRANT ALL ON public.uptime_checks TO service_role;
GRANT ALL ON public.uptime_incidents TO service_role;
GRANT ALL ON public.uptime_alert_recipients TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.uptime_checks_id_seq TO service_role;

ALTER TABLE public.uptime_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_alert_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read uptime targets" ON public.uptime_targets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read uptime checks" ON public.uptime_checks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read uptime incidents" ON public.uptime_incidents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage uptime recipients" ON public.uptime_alert_recipients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.uptime_alert_recipients (phone, label)
VALUES ('919692282485', 'Founder alert line')
ON CONFLICT (phone) DO UPDATE SET enabled = true;

SELECT cron.schedule(
  'uptime-monitor-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/uptime-monitor',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','c676c140eecab4a97391a66e6d815f9b56b95ad4033bb3d4adcc37b96c4d4ab8',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk'
    ),
    body := '{}'::jsonb
  );
  $$
);

DELETE FROM public.uptime_checks WHERE checked_at < now() - interval '14 days';
