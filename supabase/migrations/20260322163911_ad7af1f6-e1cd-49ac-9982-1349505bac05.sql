
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS domain_verification_token text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false;
