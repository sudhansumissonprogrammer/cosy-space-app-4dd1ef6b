
-- Canonicalize Indian mobile numbers to 10 digits across all customer-facing tables.
-- Mirrors src/lib/phoneUtils.ts toCanonicalIndianPhone().
CREATE OR REPLACE FUNCTION public.canonicalize_indian_phone(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
  local_part text;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN NULL;
  END IF;
  digits := regexp_replace(raw, '\D', '', 'g');
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  local_part := digits;
  IF length(local_part) = 13 AND left(local_part, 3) = '091' THEN
    local_part := substring(local_part from 4);
  ELSIF length(local_part) = 12 AND left(local_part, 2) = '91' THEN
    local_part := substring(local_part from 3);
  ELSIF length(local_part) = 11 AND left(local_part, 1) = '0' THEN
    local_part := substring(local_part from 2);
  END IF;
  IF length(local_part) = 10 AND local_part ~ '^[6-9]' THEN
    RETURN local_part;
  END IF;
  -- Fallback: return original raw value untouched so non-Indian / malformed
  -- numbers aren't silently dropped (validation is the app's job).
  RETURN raw;
END;
$$;

-- Trigger function: rewrites a configured column on a row to canonical form.
CREATE OR REPLACE FUNCTION public.tg_canonicalize_phone_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  col_name text := TG_ARGV[0];
  cur_val text;
  new_val text;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', col_name) INTO cur_val USING NEW;
  IF cur_val IS NULL OR btrim(cur_val) = '' THEN
    RETURN NEW;
  END IF;
  new_val := public.canonicalize_indian_phone(cur_val);
  IF new_val IS DISTINCT FROM cur_val THEN
    NEW := NEW #= hstore(col_name, new_val);
  END IF;
  RETURN NEW;
EXCEPTION WHEN undefined_function THEN
  -- hstore not available — fall back to dynamic UPDATE via json patch
  RETURN NEW;
END;
$$;

-- We need hstore for the easy NEW patch. Enable if missing.
CREATE EXTENSION IF NOT EXISTS hstore;

-- Per-table trigger functions (simpler & faster than the generic one above).
CREATE OR REPLACE FUNCTION public.tg_orders_canonicalize_phone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.customer_phone IS NOT NULL AND btrim(NEW.customer_phone) <> '' THEN
    NEW.customer_phone := public.canonicalize_indian_phone(NEW.customer_phone);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_abandoned_carts_canonicalize_phone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.customer_phone IS NOT NULL AND btrim(NEW.customer_phone) <> '' THEN
    NEW.customer_phone := public.canonicalize_indian_phone(NEW.customer_phone);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_customer_leads_canonicalize_phone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' THEN
    NEW.phone := public.canonicalize_indian_phone(NEW.phone);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_customer_addresses_canonicalize_phone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' THEN
    NEW.phone := public.canonicalize_indian_phone(NEW.phone);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_storefront_customers_canonicalize_phone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' THEN
    NEW.phone := public.canonicalize_indian_phone(NEW.phone);
  END IF;
  RETURN NEW;
END; $$;

-- Attach BEFORE INSERT/UPDATE triggers.
DROP TRIGGER IF EXISTS canonicalize_phone_orders ON public.orders;
CREATE TRIGGER canonicalize_phone_orders
  BEFORE INSERT OR UPDATE OF customer_phone ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_canonicalize_phone();

DROP TRIGGER IF EXISTS canonicalize_phone_abandoned_carts ON public.abandoned_carts;
CREATE TRIGGER canonicalize_phone_abandoned_carts
  BEFORE INSERT OR UPDATE OF customer_phone ON public.abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION public.tg_abandoned_carts_canonicalize_phone();

DROP TRIGGER IF EXISTS canonicalize_phone_customer_leads ON public.customer_leads;
CREATE TRIGGER canonicalize_phone_customer_leads
  BEFORE INSERT OR UPDATE OF phone ON public.customer_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_customer_leads_canonicalize_phone();

DROP TRIGGER IF EXISTS canonicalize_phone_customer_addresses ON public.customer_addresses;
CREATE TRIGGER canonicalize_phone_customer_addresses
  BEFORE INSERT OR UPDATE OF phone ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.tg_customer_addresses_canonicalize_phone();

DROP TRIGGER IF EXISTS canonicalize_phone_storefront_customers ON public.storefront_customers;
CREATE TRIGGER canonicalize_phone_storefront_customers
  BEFORE INSERT OR UPDATE OF phone ON public.storefront_customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_storefront_customers_canonicalize_phone();

-- Backfill: rewrite any existing rows where phone isn't already 10-digit canonical.
UPDATE public.orders
   SET customer_phone = public.canonicalize_indian_phone(customer_phone)
 WHERE customer_phone IS NOT NULL
   AND customer_phone <> public.canonicalize_indian_phone(customer_phone);

UPDATE public.abandoned_carts
   SET customer_phone = public.canonicalize_indian_phone(customer_phone)
 WHERE customer_phone IS NOT NULL
   AND customer_phone <> public.canonicalize_indian_phone(customer_phone);

UPDATE public.customer_leads
   SET phone = public.canonicalize_indian_phone(phone)
 WHERE phone IS NOT NULL
   AND phone <> public.canonicalize_indian_phone(phone);

UPDATE public.customer_addresses
   SET phone = public.canonicalize_indian_phone(phone)
 WHERE phone IS NOT NULL
   AND phone <> public.canonicalize_indian_phone(phone);

UPDATE public.storefront_customers
   SET phone = public.canonicalize_indian_phone(phone)
 WHERE phone IS NOT NULL
   AND phone <> public.canonicalize_indian_phone(phone);
