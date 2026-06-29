
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS wa_marketing_consent boolean NOT NULL DEFAULT false;
ALTER TABLE public.platform_config ADD COLUMN IF NOT EXISTS wa_require_marketing_consent boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS abandoned_carts_recovery_idx ON public.abandoned_carts (recovered, recovery_sent_at, created_at) WHERE recovered = false AND recovery_sent_at IS NULL;
