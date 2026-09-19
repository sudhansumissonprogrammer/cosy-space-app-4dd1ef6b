ALTER TABLE public.parcel_label_scans
  ADD COLUMN IF NOT EXISTS temp_object_path text,
  ADD COLUMN IF NOT EXISTS temp_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS parcel_label_scans_order_photo_idx
  ON public.parcel_label_scans (order_id, created_at DESC)
  WHERE decision = 'accepted' AND temp_object_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS parcel_label_scans_expired_photo_idx
  ON public.parcel_label_scans (temp_expires_at)
  WHERE temp_object_path IS NOT NULL AND photo_deleted_at IS NULL;

-- The bucket is intentionally server-only. No authenticated or anonymous
-- storage.objects policy is created; service-role edge functions bypass RLS.
