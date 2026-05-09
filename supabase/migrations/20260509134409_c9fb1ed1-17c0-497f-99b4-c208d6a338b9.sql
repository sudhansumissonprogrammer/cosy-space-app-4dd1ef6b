ALTER TABLE public.partner_referrals
  ADD COLUMN IF NOT EXISTS signup_ip text,
  ADD COLUMN IF NOT EXISTS signup_user_agent text,
  ADD COLUMN IF NOT EXISTS flagged_reason text;

CREATE INDEX IF NOT EXISTS idx_partner_referrals_flagged ON public.partner_referrals(flagged_reason) WHERE flagged_reason IS NOT NULL;