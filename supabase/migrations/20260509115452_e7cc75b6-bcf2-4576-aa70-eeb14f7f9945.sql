
-- Trigger: when a store is created, backfill partner_referrals.store_id
-- for the owner if a referral row exists without a store yet.
CREATE OR REPLACE FUNCTION public.tg_link_referral_to_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_referrals
     SET store_id = NEW.id
   WHERE referred_user_id = NEW.owner_id
     AND store_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_referral_to_store ON public.stores;
CREATE TRIGGER trg_link_referral_to_store
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.tg_link_referral_to_store();

-- Backfill: link existing referrals to their owner's earliest store.
WITH first_store AS (
  SELECT DISTINCT ON (owner_id) owner_id, id
  FROM public.stores
  ORDER BY owner_id, created_at ASC
)
UPDATE public.partner_referrals pr
   SET store_id = fs.id
  FROM first_store fs
 WHERE pr.referred_user_id = fs.owner_id
   AND pr.store_id IS NULL;
