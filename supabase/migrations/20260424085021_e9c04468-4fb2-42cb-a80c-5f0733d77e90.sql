-- Drop both overloads of the legacy storefront RPC. Safe: the storefront uses
-- get_storefront_shell exclusively. Verified by codebase grep on 2026-04-24.
DROP FUNCTION IF EXISTS public.get_storefront_data(text);
DROP FUNCTION IF EXISTS public.get_storefront_data(text, integer);