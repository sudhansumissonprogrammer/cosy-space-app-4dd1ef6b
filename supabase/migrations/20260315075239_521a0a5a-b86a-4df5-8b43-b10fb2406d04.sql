
-- Fix overly permissive insert policy - restrict to active non-suspended stores
DROP POLICY "Edge functions can insert optouts" ON public.whatsapp_optouts;

CREATE POLICY "Anyone can opt out from active stores"
  ON public.whatsapp_optouts FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = whatsapp_optouts.store_id
      AND stores.is_suspended = false
    )
  );
