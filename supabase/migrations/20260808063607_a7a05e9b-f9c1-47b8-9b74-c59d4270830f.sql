-- 1. OTP store (service-role only)
CREATE TABLE IF NOT EXISTS public.auth_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  purpose text NOT NULL DEFAULT 'merchant_signup',
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  ip text,
  user_id uuid,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.auth_otp_codes TO service_role;

ALTER TABLE public.auth_otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "otp_no_client_access" ON public.auth_otp_codes;
CREATE POLICY "otp_no_client_access"
  ON public.auth_otp_codes
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_auth_otp_phone_created
  ON public.auth_otp_codes (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_otp_expires
  ON public.auth_otp_codes (expires_at);

DROP TRIGGER IF EXISTS trg_auth_otp_touch ON public.auth_otp_codes;
CREATE TRIGGER trg_auth_otp_touch
  BEFORE UPDATE ON public.auth_otp_codes
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- 2. Profile phone fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

-- 3. Safe phone -> user lookup (never exposes email)
CREATE OR REPLACE FUNCTION public.get_user_id_by_phone(_phone text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.profiles
  WHERE phone = _phone
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_phone(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_phone(text) TO service_role;

-- 4. Cleanup helper for expired codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.auth_otp_codes
  WHERE expires_at < now() - interval '1 day'
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_otp_codes() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_otp_codes() TO service_role;