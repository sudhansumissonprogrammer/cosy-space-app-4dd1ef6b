-- Backfill: mark every store with a configured custom_domain as verified.
-- User confirmed all such domains are already pointed at Cloudflare/Lovable.
UPDATE public.stores
SET domain_verified = true
WHERE custom_domain IS NOT NULL
  AND custom_domain <> ''
  AND domain_verified IS DISTINCT FROM true;

-- Ensure webhook_events has a unique (provider, event_id) constraint so
-- idempotency inserts collide instead of silently double-processing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'webhook_events_provider_event_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.webhook_events
        ADD CONSTRAINT webhook_events_provider_event_id_key
        UNIQUE (provider, event_id);
    EXCEPTION WHEN duplicate_table OR unique_violation THEN
      -- Pre-existing duplicates: leave constraint off rather than fail migration.
      RAISE NOTICE 'webhook_events unique constraint skipped (duplicates exist)';
    END;
  END IF;
END $$;