UPDATE public.stores SET checkout_v2_enabled = true WHERE checkout_v2_enabled IS DISTINCT FROM true;
ALTER TABLE public.stores ALTER COLUMN checkout_v2_enabled SET DEFAULT true;