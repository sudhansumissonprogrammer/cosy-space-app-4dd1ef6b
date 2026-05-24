ALTER TABLE public.stores ALTER COLUMN domain_verified SET DEFAULT true;
UPDATE public.stores SET domain_verified = true WHERE domain_verified IS DISTINCT FROM true;