# ShopBanao / Storivo — Principal Engineer Security Audit (2025)

Consolidated from three parallel deep audits:
- Auth / RLS / DB (sub_29mdvddn)
- Edge Functions / Payments / Uploads / Webhooks (sub_zvy4d8ky)
- Frontend / Infrastructure / CSP / CORS (sub_6at2hp90)

---

## Severity Totals

| Severity | Count |
|----------|------:|
| 🔴 Critical | 11 |
| 🟠 High     | 18 |
| 🟡 Medium   | 19 |
| 🔵 Low / Info | 9 |
| **Total**  | **57** |

---

## 🔴 CRITICAL — Fix this week

| # | Area | File | Issue | One-line Fix |
|---|------|------|-------|--------------|
| C-1 | Payments | `supabase/functions/cashfree-webhook/index.ts:77-115` | Dedup row inserted **before** HMAC verify → DoP: attacker pre-poisons `event_id`, real webhook dropped | Verify signature BEFORE the `webhook_events` insert |
| C-2 | Payments | `cashfree-webhook/index.ts:97-115` | `store_id` taken from attacker-controlled `order_tags`; HMAC key is then selected using that store_id | Store `cfOrderId → (storeId, localOrderId)` mapping at order creation; look up from DB, never from payload |
| C-3 | Payments | `razorpay-verify/index.ts:83` & `cashfree-webhook:114` & `wallet-cashfree-webhook:30` | `===` HMAC comparison → timing oracle | `timingSafeEqual()` helper in `_shared/` |
| C-4 | Payments | `razorpay-verify/index.ts` | No idempotency / replay protection — same proof re-confirms orders & re-fires CAPI | Guard UPDATE with `.eq("payment_verified", false)` |
| C-5 | Payments | `payu-webhook/index.ts:117` | `eventId` missing `storeId` → cross-store collision drops legit payment | Include `storeId` in `eventId` & validate `key === config.payu_merchant_key` |
| C-6 | Uploads | `r2-upload/index.ts:96-120` | Path traversal — caller controls full R2 object key (`..`, cross-tenant overwrite) | Reject `..`/`//`, enforce `path` starts with `${userId}/` |
| C-7 | Auth | `verify-domain/index.ts` | **No auth at all** — any party can mark `domain_verified=true` for any store | Require JWT + verify `store.owner_id === user.id` |
| C-8 | Auth | `whatsapp-send/index.ts` | JWT validated but no store-ownership check — any user sends WA bills to any store | Add `stores.owner_id === user.id` check |
| C-9 | Auth | `auth-proxy/index.ts:4,107` | `CORS: *` while returning raw `access_token`+`refresh_token` → ATO from any origin | Strict `ALLOWED_ORIGINS` allowlist |
| C-10 | DB / RLS | `store_payment_config_public` view (`20260329153401`) | `security_invoker=false` → leaks every store's `razorpay_key_id` to anon | Drop view, replace with store-scoped `SECURITY DEFINER` RPC |
| C-11 | Orders | `place-order/index.ts:150` + `orders` RLS `Anyone can create website orders` | Service-role function + RLS allow anon to fabricate unlimited COD orders for any store | Turnstile/hCaptcha challenge token + signed checkout token in RLS `WITH CHECK` |

---

## 🟠 HIGH — Fix this sprint

### Auth & Sessions
- **AdminLogin TOCTOU** (`AdminLogin.tsx:33-56`): non-admin holds a live session until `has_role` resolves → use `signOut({scope:'global'})` and fail-closed.
- **`signOut({scope:'local'})`** (`AuthContext.tsx:113`, `StorefrontAuthContext.tsx:260`): refresh token stays valid server-side → use `'global'`.
- **In-memory rate-limit** (`auth-proxy`, `place-order`, all `generate-*`): resets on cold start → Upstash Redis or DB-backed RL.
- **`has_role(uuid, role)`** granted to authenticated → admin enumeration oracle. Add no-arg `is_admin()` and `REVOKE EXECUTE` from authenticated.
- **`razorpay-verify`/`payu-verify-payment`**: no `store.owner_id` ownership check on caller JWT.
- **`assign-store-plan`**: any user can self-assign paid plans free → require `is_free` or completed payment.
- **`partner-approve-commissions`**: timing-unsafe cron secret + `CORS:*` on state-changing cron.
- **`admin-withdrawal-action` / `admin-wallet-controls`**: `CORS:*` on admin endpoints → CSRF surface.
- **`delete-store`**: no UUID validation on `storeId`.
- **`whatsapp-webhook` POST**: no `X-Hub-Signature-256` verify → attacker forges inbound `STOP` to opt-out any customer.

### Storage / SSRF
- **`image-ops` resize**: unauthenticated open proxy, no allowlist, no private-IP block → SSRF to `169.254.169.254` IMDS.
- **`r2-upload` MIME**: trusts browser `file.type` → store webshell as `image/png`. Sniff magic bytes.

### Frontend & Infra
- **CSP `script-src 'unsafe-inline'`** (`docs/cloudflare-worker-current.js:622`): negates CSP entirely → nonce-based CSP.
- **Open redirect via push** (`src/lib/ownerPush.ts:389`): `window.location.href = payload.url` → same-origin validation.
- **Admin preview iframe** (`StorePageEditor.tsx:467`): `sandbox="allow-same-origin"` + unsanitized merchant HTML → DOMPurify + drop `allow-same-origin`.

### Generic API
- **No per-user RL on `generate-description` / `generate-store-content` / `generate-page-html`** → AI cost-amplification DoS.
- **`CORS:*` on all 64 functions** including state-changing ones → tighten to known origins.
- **`payu-webhook` weak replay protection** for repeated SUCCESS callbacks (CAPI inflation).
- **`wallet-cashfree-webhook`**: dedup INSERT errors silently swallowed → distinguish duplicate vs DB error.

### DB / GRANTs
- **`GRANT INSERT/UPDATE/DELETE ON stores TO authenticated`** (`20260414120656`): RLS is the only guard. Tighten.
- **`store_payment_config`**: verify the historical `authenticated USING(true)` policy was actually removed in prod DB (FIND-C1).

---

## 🟡 MEDIUM (selection — see subagent reports for full list)

- `postMessage` listeners with no `event.origin` check: `CustomHtmlRenderer.tsx:75`, `useThemePreview.ts:34`, `StoreThemeSettings.tsx:751` (uses `targetOrigin "*"`).
- `/api/purge-shell` unauthenticated GET+POST → cache-busting DoS across all storefronts.
- `CustomHtmlRenderer` DOMPurify config allows `data:` URIs and `<link>` tag → CSS exfiltration.
- CORS `*` on Worker Supabase proxy (`cloudflare-worker-current.js:6802`).
- `X-Frame-Options: SAMEORIGIN` applied globally — wrong for both admin (needs DENY) and storefront preview (needs `frame-ancestors`).
- No Zod/schema validation in `ProductForm`, `CreateStore`, `Signup`, `StorePayments`.
- `whatsapp_orders` RLS `WITH CHECK(true)` — no suspension check.
- `storefront_customers` INSERT not gated on `store.is_suspended=false`.
- `orders` direct PostgREST INSERT path bypasses edge-function rate-limit (C-11).
- `push_subscriptions` anon INSERT can be flooded → add per-store count guard.
- `get_store_as_admin` returns `stores%ROWTYPE` → future-column leak.
- `useAdminStoreView` caches `is-admin` for 10min (revocation lag).
- `adminStoreSession` slug stored in `sessionStorage` with no expiry → stale-context risk.
- `notify-order` email `From:` header injection via store name (only `<>"` stripped, not `\r\n`).
- `ingest` log injection — newlines in user-supplied error messages.
- `auth-proxy` cold-start RL bypass (also in High).
- `phone-login` / `create-guest-account` no rate-limit → enumeration + SMS abuse.
- All webhooks: no timestamp staleness check (5-min window).
- `billing-cron` timing-unsafe cron secret compare.

---

## 🔵 LOW / INFO

- `prewarm-cron` uses `SERVICE_ROLE_KEY` as Bearer to call another function → use dedicated cron secret.
- `r2-delete` ownership check bypassable via `..` in key (normalize first).
- `GuideDetail.tsx` `dangerouslySetInnerHTML` on static repo content — acceptable, monitor.
- `sb_vid` cookie missing `Secure` flag.
- `.env`: only anon/publishable keys — no service role leak. ✅
- `adminStoreSession` is slug-only, not auth — no client-side bypass. ✅
- `get_admin_stats` reads `auth.users` directly — admin-gated, OK but fragile.
- `can_create_website_order` granted to anon → store-existence oracle.
- `StorefrontAuthContext` writes `user_type: "customer"` into `raw_user_meta_data` — verify no policy reads it for authz.

---

## Top-5 Drop-Everything Fixes

1. **C-1 + C-2** — Cashfree webhook: verify HMAC before dedup AND source `store_id` from DB mapping, not payload tags. Together these enable payment fraud and denial-of-payment.
2. **C-3** — Replace `===` with constant-time compare in Razorpay/Cashfree HMAC checks. One-line, critical impact.
3. **C-6** — Reject `..` and enforce `userId/` prefix in `r2-upload`. Prevents cross-tenant file overwrite.
4. **C-7 + C-8** — Add JWT + ownership checks to `verify-domain` and `whatsapp-send`.
5. **C-9 + C-10** — Lock `auth-proxy` CORS to an origin allowlist and drop the `security_invoker=false` `store_payment_config_public` view (replace with `SECURITY DEFINER` RPC).

---

## Verification Queries (run in prod)

```sql
-- C-10 / FIND-C3: confirm view is gone or invoker=true
SELECT viewname, definition FROM pg_views
WHERE viewname IN ('store_payment_config_public','stores_public');

-- FIND-C1: confirm the dangerous policy was actually dropped
SELECT * FROM pg_policies
WHERE tablename='store_payment_config'
  AND policyname='Authenticated can view payment config';

-- FIND-F3: any function/policy authorizing on raw_user_meta_data?
SELECT proname FROM pg_proc
WHERE pronamespace='public'::regnamespace
  AND prosrc ILIKE '%user_meta_data%';
```

Full per-finding fix code (production-ready snippets) is in the three subagent reports above this file in the audit conversation.
