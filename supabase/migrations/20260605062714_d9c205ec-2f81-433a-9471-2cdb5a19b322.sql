-- Add per-store retention override
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS analytics_retention_days integer NOT NULL DEFAULT 90;

-- Cleanup function: deletes raw analytics rows older than each store's retention window
CREATE OR REPLACE FUNCTION public.cleanup_old_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pv_deleted bigint := 0;
  ev_deleted bigint := 0;
  batch_count int;
  default_days int := 90;
BEGIN
  -- page_views: per-store retention, batched
  LOOP
    WITH victims AS (
      SELECT pv.id
      FROM public.page_views pv
      LEFT JOIN public.stores s ON s.id = pv.store_id
      WHERE pv.created_at < now() - (COALESCE(s.analytics_retention_days, default_days) || ' days')::interval
      LIMIT 10000
    )
    DELETE FROM public.page_views pv USING victims WHERE pv.id = victims.id;
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    pv_deleted := pv_deleted + batch_count;
    EXIT WHEN batch_count = 0;
  END LOOP;

  -- storefront_events: per-store retention, batched
  LOOP
    WITH victims AS (
      SELECT ev.id
      FROM public.storefront_events ev
      LEFT JOIN public.stores s ON s.id = ev.store_id
      WHERE ev.created_at < now() - (COALESCE(s.analytics_retention_days, default_days) || ' days')::interval
      LIMIT 10000
    )
    DELETE FROM public.storefront_events ev USING victims WHERE ev.id = victims.id;
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    ev_deleted := ev_deleted + batch_count;
    EXIT WHEN batch_count = 0;
  END LOOP;

  RETURN jsonb_build_object(
    'page_views_deleted', pv_deleted,
    'storefront_events_deleted', ev_deleted,
    'ran_at', now()
  );
END;
$$;

-- Supporting indexes (created_at filters)
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views (created_at);
CREATE INDEX IF NOT EXISTS idx_storefront_events_created_at ON public.storefront_events (created_at);