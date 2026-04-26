ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Backfill: any currently-suspended store is treated as admin-suspended so
-- a future payment doesn't accidentally unsuspend them.
UPDATE public.stores
SET suspension_reason = 'admin'
WHERE is_suspended = true AND suspension_reason IS NULL;