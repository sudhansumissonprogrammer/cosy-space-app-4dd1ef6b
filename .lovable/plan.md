
# Account Creation Hardening — Fix All 3 Issues

## What changes

### Fix 1 — Stop killing other-device sessions (severe)
Today both `create-guest-account` and `phone-login` rotate the user's password on **every** call, which invalidates every refresh token that user has on any other device. Customer logs in on phone, then checks out on laptop → phone gets silently logged out.

**Approach:** Use Supabase admin `generateLink({ type: 'magiclink' })` + `verifyOtp({ type: 'magiclink', token_hash })` to mint a session **without touching the password**. This is the official supported path for "log this user in server-side." Zero refresh-token disruption across devices, zero race between parallel tabs.

Behavior:
- **New user** → `admin.createUser()` once (no password set, or a one-time random one that is never rotated again).
- **Existing user** → skip password update entirely; just generate a magic link, extract the `token_hash`, and exchange it for a session via `verifyOtp`.
- Same client-facing return shape (`{ session: { access_token, refresh_token } }`), so no frontend changes needed.

### Fix 2 — Replace `listUsers` pagination with O(1) lookup (scalability)
Current fallback paginates up to 50,000 / 4,000 users on every checkout — already slow at ~1.8k users, breaks at 10k+.

**Approach:** Add a `SECURITY DEFINER` SQL helper:

```sql
CREATE FUNCTION public.get_auth_user_id_by_email(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;
```

Both edge functions replace their `listUsers` loops with a single `supabase.rpc("get_auth_user_id_by_email", { _email: phoneEmail })` call.

### Fix 3 — Stop clobbering customer-edited profile fields (polish)
In `create-guest-account`, when the `storefront_customers` row already exists, the `UPDATE` overwrites `name`, `phone`, `email` even if the customer had set them later in /account.

**Approach:** Switch to COALESCE-style guarded update — only fill columns that are currently NULL/empty. Phone always stays canonical (it's the identity key). Never overwrite a customer-saved name or email from a fresh checkout typo.

## Files touched

- `supabase/migrations/<new>.sql` — adds `get_auth_user_id_by_email()` helper.
- `supabase/functions/phone-login/index.ts` — swap listUsers loop for RPC; replace password-rotate path with `generateLink` + `verifyOtp`.
- `supabase/functions/create-guest-account/index.ts` — same two swaps + COALESCE-style storefront_customers update.

No frontend changes. No DB schema changes other than the one helper function.

## Risk & rollback

- Magic-link path is the officially supported Supabase admin pattern, so no API risk.
- If `generateLink` ever returns an error, fall back to `signInWithPassword` with a freshly-set password (current behavior) — degrades gracefully instead of failing.
- Helper function is additive; safe to revert by dropping it.

## Verification after ship

1. Trigger checkout twice from two different browsers on the same phone number — confirm both sessions stay alive (no `refresh_token_not_found` 400s in auth logs).
2. Check edge-function logs for `phone-login` and `create-guest-account` — should see no `listUsers` calls.
3. Edit name/email in /account, then do a fresh checkout with a typo — confirm /account values are preserved.
