CREATE TABLE public.parcel_label_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  scanned_by uuid NOT NULL,
  image_sha256 text NOT NULL CHECK (image_sha256 ~ '^[a-f0-9]{64}$'),
  decision text NOT NULL CHECK (decision IN ('accepted', 'rejected', 'review')),
  confidence numeric(5,4) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  courier_slug text,
  tracking_number text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasons text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.parcel_label_scans TO authenticated;
GRANT ALL ON public.parcel_label_scans TO service_role;
ALTER TABLE public.parcel_label_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view parcel label scans"
ON public.parcel_label_scans
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s
  WHERE s.id = parcel_label_scans.store_id
    AND s.owner_id = auth.uid()
));
CREATE INDEX parcel_label_scans_order_created_idx
ON public.parcel_label_scans(order_id, created_at DESC);
CREATE UNIQUE INDEX parcel_label_scans_accepted_image_unique
ON public.parcel_label_scans(store_id, image_sha256)
WHERE decision = 'accepted';
CREATE UNIQUE INDEX parcel_label_scans_accepted_awb_unique
ON public.parcel_label_scans(store_id, upper(tracking_number))
WHERE decision = 'accepted' AND tracking_number IS NOT NULL;