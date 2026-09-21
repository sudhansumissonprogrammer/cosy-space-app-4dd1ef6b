DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.migration_jobs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%source_platform%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.migration_jobs DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;

ALTER TABLE public.migration_jobs
  ADD CONSTRAINT migration_jobs_source_platform_check
  CHECK (source_platform IN ('shopify','shopify-public','woocommerce','dukaan','bigcommerce','magento','generic'));