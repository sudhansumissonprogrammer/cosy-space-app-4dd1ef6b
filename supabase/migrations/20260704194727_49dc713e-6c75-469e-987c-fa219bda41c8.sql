ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS wa_meta_breaker jsonb NOT NULL DEFAULT '{"failures":0,"open_until":null,"last_error":null,"last_usage":null}'::jsonb;