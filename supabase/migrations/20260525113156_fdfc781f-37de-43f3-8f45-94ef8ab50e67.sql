
-- Extend push_subscriptions for store-owner device push notifications
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS device_label text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz NOT NULL DEFAULT now();

-- Allow store_id to be NULL (owner-level subscriptions are user-scoped)
ALTER TABLE public.push_subscriptions
  ALTER COLUMN store_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_subs_store ON public.push_subscriptions(store_id) WHERE store_id IS NOT NULL;

-- New RLS: owners can manage their own device subscriptions
DROP POLICY IF EXISTS "Users can insert their own push subs" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can view their own push subs" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subs" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subs" ON public.push_subscriptions;

CREATE POLICY "Users can insert their own push subs"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own push subs"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subs"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subs"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
