ALTER TABLE public.parcel_label_scans
ADD COLUMN IF NOT EXISTS photo_object_path text;

CREATE INDEX IF NOT EXISTS parcel_label_scans_order_accepted_photo_idx
ON public.parcel_label_scans (order_id, created_at DESC)
WHERE decision = 'accepted' AND photo_object_path IS NOT NULL;