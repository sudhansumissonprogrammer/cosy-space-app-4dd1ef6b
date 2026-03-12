
-- FIX 1: Remove anon SELECT on base store_payment_config table (exposes razorpay_key_secret)
DROP POLICY IF EXISTS "Public can view payment config via view" ON public.store_payment_config;

-- Recreate view as SECURITY DEFINER to allow anon access through view only
DROP VIEW IF EXISTS public.store_payment_config_public;
CREATE VIEW public.store_payment_config_public
WITH (security_invoker = off) AS
SELECT id, store_id, payment_methods, razorpay_key_id, created_at, updated_at
FROM public.store_payment_config;

-- Grant SELECT on the view to anon and authenticated
GRANT SELECT ON public.store_payment_config_public TO anon, authenticated;

-- FIX 2: Prevent users from updating is_blocked on their own profile
-- Drop existing user update policy and recreate with restriction
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND is_blocked = false);

-- Create a trigger to prevent users from changing is_blocked
CREATE OR REPLACE FUNCTION public.prevent_self_unblock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If is_blocked changed and the user is not an admin, reject
  IF OLD.is_blocked IS DISTINCT FROM NEW.is_blocked THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can change block status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_unblock_trigger ON public.profiles;
CREATE TRIGGER prevent_self_unblock_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_unblock();

-- FIX 3: Tighten abandoned_carts UPDATE to prevent overwriting other carts
-- Add a session_token column for cart ownership verification
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS session_token text;

DROP POLICY IF EXISTS "Anyone can update abandoned carts by id" ON public.abandoned_carts;
CREATE POLICY "Store owners can update abandoned carts"
ON public.abandoned_carts
FOR UPDATE
TO authenticated
USING (is_store_owner(store_id));
