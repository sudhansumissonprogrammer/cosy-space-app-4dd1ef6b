-- Phase 2 QA fix: clawback path when refund arrives on a commission already paid out
CREATE TABLE IF NOT EXISTS public.partner_clawbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES public.partner_commissions(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open | recovered | written_off
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_partner_clawbacks_partner ON public.partner_clawbacks(partner_id, status);
ALTER TABLE public.partner_clawbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage clawbacks" ON public.partner_clawbacks;
CREATE POLICY "Admins manage clawbacks"
ON public.partner_clawbacks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Partner views own clawbacks" ON public.partner_clawbacks;
CREATE POLICY "Partner views own clawbacks"
ON public.partner_clawbacks FOR SELECT TO authenticated
USING (public.is_partner_owner(partner_id));

-- Replace refund handler so paid commissions are clawed back instead of silently skipped
CREATE OR REPLACE FUNCTION public.tg_subscription_payment_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.partner_commissions%ROWTYPE;
BEGIN
  IF NEW.status = 'refunded' AND COALESCE(OLD.status,'') <> 'refunded' THEN
    SELECT * INTO c FROM public.partner_commissions WHERE payment_id = NEW.id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    IF c.status IN ('pending','approved') THEN
      PERFORM public.wallet_reverse_commission(c.id);
    ELSIF c.status = 'paid' THEN
      INSERT INTO public.partner_clawbacks(partner_id, commission_id, amount)
      VALUES (c.partner_id, c.id, c.commission_amount)
      ON CONFLICT DO NOTHING;

      PERFORM public._notify_partner(
        c.partner_id, 'commission_clawback',
        'Commission clawback: ₹' || c.commission_amount::text,
        'A previously paid commission was refunded by the customer. Our team will contact you for recovery.',
        jsonb_build_object('commission_id', c.id, 'amount', c.commission_amount)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;