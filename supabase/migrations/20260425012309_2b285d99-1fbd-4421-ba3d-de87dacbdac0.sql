
-- Event trigger: prevent accidental overload duplication on critical storefront RPCs
CREATE OR REPLACE FUNCTION public.guard_storefront_rpc_overloads()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  obj record;
  fn_name text;
  overload_count int;
  protected_fns text[] := ARRAY['get_storefront_shell', 'get_store_public', 'get_storefront_data'];
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE FUNCTION')
      AND object_type = 'function'
  LOOP
    -- Extract bare function name (without schema/args)
    SELECT proname INTO fn_name
    FROM pg_proc
    WHERE oid = obj.objid;

    IF fn_name = ANY(protected_fns) THEN
      SELECT COUNT(*) INTO overload_count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name;

      IF overload_count > 1 THEN
        RAISE EXCEPTION
          'Refusing to create duplicate overload of public.%(): % versions now exist. PostgREST cannot disambiguate and storefronts will break (PGRST203). Add `DROP FUNCTION IF EXISTS public.%(<old_signature>);` before CREATE OR REPLACE.',
          fn_name, overload_count, fn_name;
      END IF;
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS prevent_storefront_rpc_overloads;
CREATE EVENT TRIGGER prevent_storefront_rpc_overloads
ON ddl_command_end
WHEN TAG IN ('CREATE FUNCTION')
EXECUTE FUNCTION public.guard_storefront_rpc_overloads();

COMMENT ON FUNCTION public.guard_storefront_rpc_overloads() IS
'Prevents the storefront outage of 2026-04-24: blocks duplicate overloads of critical RPCs that PostgREST cannot disambiguate.';
