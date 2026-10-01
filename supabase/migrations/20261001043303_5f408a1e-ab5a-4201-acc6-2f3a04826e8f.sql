CREATE TABLE public.wa_onboarding_sessions (
  phone text PRIMARY KEY,
  step text NOT NULL DEFAULT 'brand',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  store_id uuid,
  user_id uuid,
  message_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wa_onboarding_sessions TO service_role;
ALTER TABLE public.wa_onboarding_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view onboarding sessions" ON public.wa_onboarding_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.wa_onboarding_sessions TO authenticated;
CREATE TRIGGER wa_onboarding_sessions_touch BEFORE UPDATE ON public.wa_onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- Atomically claim the "creating" step so double taps never create two stores.
CREATE OR REPLACE FUNCTION public.claim_wa_onboarding_create(_phone text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    UPDATE public.wa_onboarding_sessions
       SET status = 'creating', step = 'creating'
     WHERE phone = _phone AND status = 'active' AND step = 'confirm'
     RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM c);
$$;
REVOKE ALL ON FUNCTION public.claim_wa_onboarding_create(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wa_onboarding_create(text) TO service_role;