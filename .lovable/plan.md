# Security Hardening Sprint — Critical + High Fixes

Scope: 11 Critical, 18 High findings from `docs/SECURITY_AUDIT_2025.md`, plus a one-time backfill that marks every store domain already pointing at Cloudflare/Lovable as `verified`. Nothing is removed from the storefront UX; every fix is additive or a tightened check. Each function is fixed independently so a mistake in one cannot crash another.

---

## Phase 1 — Payment webhooks (Critical #1–#5)

**1. Cashfree webhook (`supabase/functions/cashfree-webhook/index.ts`)**
- Re-order: read raw body → verify HMAC → THEN insert dedup row in `webhook_events`.
- Stop trusting `order_tags.store_id`. Resolve `store_id` from `orders.cf_order_id` (our DB) only. If not found, 404.
- Replace `===` with `timingSafeEqual` (Web Crypto `crypto.subtle` + constant-time compare helper).
- Add timestamp staleness check (reject > 5 min skew).

**2. `wallet-cashfree-webhook/index.ts`** — same `timingSafeEqual` swap + same store_id lookup from DB.

**3. Razorpay verify (`razorpay-verify/index.ts`)**
- `timingSafeEqual` on signature.
- Add idempotency: insert `(razorpay_payment_id)` into `webhook_events` with unique index; if conflict → return existing result, never re-mark order paid.
- Ownership check: order must belong to caller's `storefront_customer_id` OR be a guest order whose `cart_token` matches the session cookie.

**4. PayU webhook (`payu-webhook/index.ts`)**
- `eventId` becomes `${storeId}:${txnid}` so cross-store txn collisions cannot swallow a real payment.
- Add ownership check in `payu-verify`.

**5. `assign-store-plan/index.ts`** — require `has_role(auth.uid(),'admin')`; reject self-assignment of paid plans.

---

## Phase 2 — Edge function auth + tenant isolation (Critical #6–#9, High items)

**6. `r2-upload/index.ts`**
- Caller sends only `filename` + `kind` (`product|store|media`). Server builds key: `stores/<store_id>/<kind>/<uuid>.<ext>`.
- Verify `store_id` belongs to `auth.uid()` via `stores.user_id` or admin role.
- Sniff first 12 bytes; allow only image/webp/jpeg/png/gif/mp4/webm magic numbers. Reject if browser MIME disagrees.

**7. `verify-domain/index.ts`**
- Require JWT.
- Require `stores.user_id = auth.uid()` for the `store_id` being verified (or admin).
- Keep existing DNS check logic.

**8. `whatsapp-send/index.ts`** — require JWT + ownership of `store_id` (same pattern). Reject otherwise.

**9. `auth-proxy/index.ts`**
- Replace `Access-Control-Allow-Origin: *` with an allowlist: `shopbanao.in`, `www.shopbanao.in`, `*.shopbanao.in`, `*.lovable.app`, `localhost:8080`. Echo only matching origin.
- Add `Vary: Origin`.

**10. `whatsapp-webhook` POST** — verify `X-Hub-Signature-256` HMAC with `META_APP_SECRET` (constant-time). Drop request otherwise.

**11. `image-ops` SSRF** — whitelist hostnames (`cdn.shopbanao.in`, `*.supabase.co`, `*.r2.cloudflarestorage.com`). Block private/loopback/link-local/IMDS ranges (169.254.0.0/16, 10.0.0.0/8, etc.) after DNS resolve.

**12. `push-notification` open redirect** — validate `url` is same-origin to caller's store domain.

---

## Phase 3 — Database / RLS (Critical #10–#11, High RLS items)

Single migration:

- **Drop view** `store_payment_config_public`. Replace with `SECURITY DEFINER` RPC `get_store_payment_methods(_store_slug text)` returning ONLY `payment_methods text[]` and `currency` — never `razorpay_key_id`, secrets, or merchant IDs. Grant `EXECUTE TO anon, authenticated`.
- **`orders` RLS hardening**: drop any `WITH CHECK (true)` insert policy. New insert policy: `auth.uid() = customer_user_id OR (customer_user_id IS NULL AND cart_token = current_setting('request.headers.cart-token', true))`. Guest COD orders MUST go through `place-order` edge function only.
- **`place-order/index.ts`**: add per-IP + per-phone rate limit via `webhook_events`-style table `order_rate_limits(ip, phone, window_start, count)` (5 orders / 10 min / IP). Require either JWT or valid `cart_token` cookie + phone OTP for COD over ₹2000.
- **`has_role()` enumeration**: change function to return `false` and `RAISE LOG` (not `RAISE EXCEPTION`) so timing is uniform.
- **`GRANT ... ON stores TO authenticated`**: narrow to `SELECT (id, slug, name, theme, logo_url, banner_url, …public cols…)`. Sensitive cols (`razorpay_key_secret_encrypted`, `cashfree_secret_encrypted`, etc.) revoked from `authenticated`; only `service_role` reads them.
- Add `webhook_events.unique(provider, event_id)` if missing.

---

## Phase 4 — Frontend hardening (High)

- **`AdminLogin.tsx`** TOCTOU — re-check `has_role` AFTER `setSession`, not before.
- **All `supabase.auth.signOut()` calls** — switch to `signOut({ scope: 'global' })` so the refresh token is revoked server-side.
- **CSP** (`index.html`, worker headers) — remove `'unsafe-inline'` from `script-src`. Replace inline boot scripts with a single hashed `<script>` (sha256 in CSP). Keep `style-src 'unsafe-inline'` only.
- **Admin preview iframe** — drop `allow-same-origin` from sandbox; sanitize HTML through DOMPurify with strict config (no `data:` URIs, no `<link>`, no `<meta http-equiv>`).
- **`postMessage` listeners** (3 files) — check `event.origin` against allowlist before processing.
- **`/api/purge-shell`** — require admin JWT or signed token.

---

## Phase 5 — One-time domain auto-verify

User request: every custom domain they've added in Cloudflare should be marked `verified`.

- One-off SQL (via insert tool, not migration):
  ```sql
  UPDATE public.stores
  SET custom_domain_verified = true,
      custom_domain_verified_at = now()
  WHERE custom_domain IS NOT NULL
    AND custom_domain <> ''
    AND custom_domain_verified IS DISTINCT FROM true;
  ```
- Then run the existing `verify-domain` DNS check in the background for each row and log mismatches to `error_logs` so the user sees which (if any) are actually misconfigured — but they stay marked verified per request.
- Going forward, `verify-domain` still re-checks DNS on demand; the auto-verify is a one-time backfill, not a permanent bypass.

---

## Technical notes

- `timingSafeEqual` helper (shared):
  ```ts
  function timingSafeEqual(a: string, b: string) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }
  ```
- CORS allowlist helper placed in `supabase/functions/_shared/cors.ts` and imported by every function instead of `*`.
- Migrations: 3 separate migration calls (view+RPC, RLS+grants, has_role) so a failure in one doesn't roll back the others.
- No worker changes required — fixes are inside edge functions + DB + frontend.
- No breaking changes to storefront API surface; clients keep calling the same endpoints with same payloads except `r2-upload` (now takes `filename`+`kind` instead of full `key`) and `auth-proxy` (origin must match allowlist).

---

## Rollout order (safe)

1. Migration: new RPC + drop view + RLS (Phase 3) → frontend keeps working because storefront only reads `payment_methods` (already fixed in last turn).
2. Edge function fixes Phase 1 → Phase 2 (deploy each, smoke-test webhook with a Razorpay test order).
3. Frontend CSP + signOut + admin iframe (Phase 4).
4. Domain backfill SQL (Phase 5).
5. Mark each finding `fixed` in security memory.

Estimated touch: ~14 edge functions, 3 migrations, ~8 frontend files, 1 data backfill. No user-visible behaviour change except: failed payments due to forged webhooks now stay failed, and `r2-upload` clients (admin product upload) need the smaller payload — that single call site is updated in the same change.
