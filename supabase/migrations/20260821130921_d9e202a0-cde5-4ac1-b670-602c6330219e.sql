ALTER TABLE public.store_app_leads
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.auth_otp_codes
  ADD COLUMN IF NOT EXISTS store_id uuid;

CREATE INDEX IF NOT EXISTS idx_auth_otp_codes_purpose_phone
  ON public.auth_otp_codes(purpose, phone, created_at DESC);