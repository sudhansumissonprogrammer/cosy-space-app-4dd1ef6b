
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  context text,
  stack text,
  url text,
  user_agent text,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  metadata jsonb
);

-- Only service role can insert/read — no public access
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage error logs"
ON public.error_logs FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view error logs"
ON public.error_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Auto-cleanup: index for efficient date-based queries
CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_store_id ON public.error_logs(store_id);
