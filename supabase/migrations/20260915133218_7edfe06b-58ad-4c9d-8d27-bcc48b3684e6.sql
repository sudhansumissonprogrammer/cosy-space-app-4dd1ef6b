CREATE UNLOGGED TABLE public.auth_session_mint_leases (
  user_id uuid PRIMARY KEY,
  owner uuid NOT NULL,
  expires_at timestamptz NOT NULL
);

GRANT ALL ON public.auth_session_mint_leases TO service_role;

ALTER TABLE public.auth_session_mint_leases ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_auth_session_mint(_user_id uuid, _owner uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auth_session_mint_leases (user_id, owner, expires_at)
  VALUES (_user_id, _owner, clock_timestamp() + interval '15 seconds')
  ON CONFLICT (user_id) DO UPDATE
    SET owner = EXCLUDED.owner,
        expires_at = EXCLUDED.expires_at
    WHERE public.auth_session_mint_leases.expires_at < clock_timestamp();

  RETURN EXISTS (
    SELECT 1
    FROM public.auth_session_mint_leases
    WHERE user_id = _user_id
      AND owner = _owner
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_auth_session_mint(_user_id uuid, _owner uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  DELETE FROM public.auth_session_mint_leases
  WHERE user_id = _user_id
    AND owner = _owner;
$$;

REVOKE ALL ON FUNCTION public.claim_auth_session_mint(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_auth_session_mint(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_auth_session_mint(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_auth_session_mint(uuid, uuid) TO service_role;