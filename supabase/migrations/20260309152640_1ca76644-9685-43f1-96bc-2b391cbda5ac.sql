
-- Create store_payment_config table
CREATE TABLE public.store_payment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE,
  payment_methods jsonb NOT NULL DEFAULT '["cod"]'::jsonb,
  razorpay_key_id text,
  razorpay_key_secret text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_payment_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Store owners can view payment config"
  ON public.store_payment_config FOR SELECT
  TO public
  USING (is_store_owner(store_id));

CREATE POLICY "Store owners can insert payment config"
  ON public.store_payment_config FOR INSERT
  TO authenticated
  WITH CHECK (is_store_owner(store_id) AND NOT is_user_blocked());

CREATE POLICY "Store owners can update payment config"
  ON public.store_payment_config FOR UPDATE
  TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked());

CREATE POLICY "Store owners can delete payment config"
  ON public.store_payment_config FOR DELETE
  TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked());

CREATE POLICY "Admins can manage payment config"
  ON public.store_payment_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public read for storefront checkout
CREATE POLICY "Public can view payment methods"
  ON public.store_payment_config FOR SELECT
  TO anon
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_store_payment_config_updated_at
  BEFORE UPDATE ON public.store_payment_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
