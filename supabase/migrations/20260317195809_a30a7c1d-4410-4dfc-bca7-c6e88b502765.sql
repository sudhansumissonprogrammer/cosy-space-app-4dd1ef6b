
-- Push subscriptions table for web-push notifications
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (storefront visitors)
CREATE POLICY "Anyone can insert push subscriptions"
  ON public.push_subscriptions FOR INSERT TO public
  WITH CHECK (is_store_active(store_id));

-- Store owners can view their subscriptions
CREATE POLICY "Store owners can view push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (is_store_owner(store_id));

-- Allow deleting own subscription by endpoint
CREATE POLICY "Anyone can delete own subscription"
  ON public.push_subscriptions FOR DELETE TO public
  USING (true);
