-- Fix serdiyajewellers store: convert legacy 'lifetime' billing_status to proper monthly 'active' cycle
UPDATE public.store_plan_assignments
SET 
  billing_status = 'active',
  current_period_end = now() + interval '30 days',
  trial_ends_at = NULL,
  grace_period_ends_at = NULL,
  is_free_lifetime = false,
  is_one_time = false,
  updated_at = now()
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'serdiyajewellers' LIMIT 1)
  AND is_free_lifetime = false
  AND is_one_time = false;