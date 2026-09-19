DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.order_shipments
    WHERE awb IS NOT NULL AND btrim(awb) <> '' AND status NOT IN ('cancelled', 'returned')
    GROUP BY store_id, upper(btrim(awb))
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS order_shipments_store_awb_active_uniq
    ON public.order_shipments (store_id, upper(btrim(awb)))
    WHERE awb IS NOT NULL AND btrim(awb) <> '' AND status NOT IN ('cancelled', 'returned');
  END IF;
END $$;