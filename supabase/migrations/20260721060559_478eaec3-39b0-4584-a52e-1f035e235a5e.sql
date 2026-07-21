CREATE TABLE IF NOT EXISTS public.upsell_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  offer_id text NOT NULL,
  placement text NOT NULL,
  event_type text NOT NULL,
  product_id uuid,
  order_id uuid,
  revenue_paise bigint NOT NULL DEFAULT 0,
  session_id text,
  customer_id uuid,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upsell_events_store_created ON public.upsell_events (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upsell_events_offer ON public.upsell_events (store_id, offer_id, event_type);

GRANT SELECT ON public.upsell_events TO authenticated;
GRANT ALL ON public.upsell_events TO service_role;

ALTER TABLE public.upsell_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners read own upsell events" ON public.upsell_events;
CREATE POLICY "Store owners read own upsell events"
  ON public.upsell_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = upsell_events.store_id AND s.owner_id = auth.uid()
    )
  );