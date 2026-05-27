# Security Hardening Plan — Storivo / ShopBanao

Goal: close every known loophole and add automated guardrails so a hacker can't tamper with orders, read other tenants' data, hijack auth, or abuse edge functions. Scope = full repo (~28K LOC frontend + 59 edge functions + DB).

I already ran the security scanner. It surfaced **9 concrete findings** (3 errors, 6 warnings). The plan fixes those first, then does a deep manual sweep grouped by attack surface.

---

## Phase 1 — Critical fixes (block real exploits) 🔴

These are already-confirmed holes. Ship these first.

1. **`place-order` price/status tampering (CRITICAL)**
   - Server re-fetches `products.price` / `product_variants.price` for every line item; ignores client `price` and `total`.
   - Recompute total server-side (items + validated coupon + validated shipping + tax).
   - Hardcode initial `status` (`pending` for online, `confirmed` for COD). Never trust client.
   - Apply same fix to `razorpay-order`, `store-cashfree-create-order`, `cashfree-create-order`, `wallet-cashfree-create-order` — payment-gateway amount must be derived from DB, not browser.

2. **`ingest?type=cleanup` deletes data with no auth**
   - Replace `Bearer ` prefix check with real `supabase.auth.getClaims(token)` + `has_role(uid,'admin')`.
   - Or move cleanup to a `verify_jwt`-enforced cron-only function using service-role internally and reject all public HTTP.

3. **WhatsApp webhook verify token hardcoded**
   - Remove `'shopbanao_webhook_verify'` fallback in `whatsapp-webhook/index.ts`; return 403 if env missing.
   - Rotate token in Meta dashboard, store new value as secret, update store-owner UI to read it from a protected RPC instead of hardcoding.

4. **`CustomHtmlRenderer` iframe sandbox escape**
   - Drop `allow-same-origin` from sandbox attribute (postMessage works cross-origin).
   - Tighten DOMPurify: remove `iframe` from `ADD_TAGS`, keep an allowlist (`style`, `link`), set `ALLOW_UNKNOWN_PROTOCOLS: false`.

5. **`products.cost_price` leaks profit margin to anonymous shoppers**
   - `REVOKE SELECT (cost_price) ON public.products FROM anon, authenticated;`
   - Storefronts already use `get_storefront_data` RPC — confirm it doesn't expose cost_price.

6. **`whatsapp_config.access_token` readable by owner via direct SELECT**
   - Add `REVOKE SELECT (access_token, app_secret, webhook_verify_token) ON public.whatsapp_config FROM authenticated;`
   - Owner UI must read masked status via security-definer RPC, not direct table.

7. **Cross-tenant config leaks** (`store_shipping_config`, `store_tax_config`, `store_theme_config`)
   - Replace `USING(true)` SELECT policies with `USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = store_id AND s.is_active))` OR remove anon SELECT entirely and route through existing storefront RPCs.

8. **`SECURITY DEFINER` view flagged by Supabase linter**
   - Identify the view, rewrite as `SECURITY INVOKER` or convert to a function with explicit search_path.

---

## Phase 2 — Edge function deep audit (59 functions) 🟠

Pattern-sweep every function for these classes:

- **JWT validation**: every function that mutates data must call `auth.getClaims()` and check ownership/role. Functions to re-check first: `delete-store`, `assign-store-plan`, `admin-*`, `partner-*`, `notify-order`, `verify-domain`, `generate-*`.
- **Webhook signature verification**: confirm HMAC check + timestamp window on `cashfree-webhook`, `wallet-cashfree-webhook`, `whatsapp-webhook`, `razorpay-*`. Add replay protection via `webhook_events` dedupe (already partially done — extend to all).
- **IDOR**: every function that takes `store_id` / `order_id` / `partner_id` from body must verify caller owns that resource (via RLS-respecting client OR explicit ownership check).
- **Service-role misuse**: search `SUPABASE_SERVICE_ROLE_KEY` usage; ensure it's never reachable on a path without auth + authz.
- **Input validation**: add Zod schemas to every function (currently inconsistent). Reject unknown fields.
- **CORS**: confirm `Access-Control-Allow-Origin` is not `*` for endpoints that read cookies/auth headers from browser (most are fine, but audit `auth-proxy`, `phone-login`, `create-guest-account`).
- **Rate limiting**: add per-IP + per-user limits on `phone-login`, `create-guest-account`, `place-order`, `track-referral-click`, `reverse-geocode`, `generate-*` (AI cost abuse).
- **AI prompt injection / cost abuse**: `generate-description`, `generate-page-html`, `generate-store-content` — gate behind plan tier + monthly quota, validate prompt size, strip user-controlled system prompts.

---

## Phase 3 — Database / RLS sweep 🟠

- Run `supabase--linter` and fix every error/warning.
- For each public-schema table, verify:
  - RLS is enabled
  - No `USING (true)` on tables holding tenant data
  - GRANTs match policy intent (no `anon` grant on auth-only tables)
  - Sensitive columns (tokens, emails, phone, cost_price, internal notes) have column-level REVOKE
- Check all `SECURITY DEFINER` functions for: `SET search_path = public`, no dynamic SQL, validated args.
- Verify `user_roles` is the ONLY role source — grep for any `profiles.role` / `is_admin` columns and remove.
- Check storage bucket policies (R2 + Supabase storage) — public read OK only for product/media buckets, never for invoices/exports.

---

## Phase 4 — Frontend (dashboard + storefront + admin) 🟡

- **XSS sinks**: grep `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`. Currently only `CustomHtmlRenderer` (fixed Phase 1). Re-verify after sweep.
- **Auth bypass in routes**: confirm `AdminRoute`, `ProtectedRoute`, `PartnerRoute`, storefront-account guard all check session AND role server-side (RPC), not just localStorage.
- **Client-side admin checks**: grep for any `localStorage.getItem('isAdmin')` style logic — remove.
- **Secret leaks in client bundle**: confirm only `VITE_SUPABASE_URL` + publishable key are in `import.meta.env`. Grep `VITE_` for accidental private keys.
- **Open redirects**: audit `?redirect=`, `?next=` query handling in `Login`, `AuthCallback`, storefront login — allowlist same-origin only.
- **CSRF on state-changing forms**: Supabase JWT in Authorization header is CSRF-safe; confirm no cookie-based mutation endpoints.
- **PostMessage listeners**: `CustomHtmlRenderer` listens to `message` — verify origin check.
- **File upload validation**: `r2-upload`, `MediaLibrary`, product image upload — enforce MIME allowlist + size cap server-side, not just client.
- **PWA `sw-push.js`**: verify it doesn't cache authenticated responses or leak tokens.

---

## Phase 5 — Auth & session hardening 🟡

- Enable Supabase **leaked-password (HIBP)** check via `configure_auth`.
- Confirm email confirmation is ON for signup (per project rules).
- Reduce JWT lifetime + rotate refresh tokens (already default — verify).
- Rate limit login: `useLoginRateLimit` exists for admin login — extend to user `Login`, `StorefrontLogin`, `PartnerLogin`, `ForgotPassword`.
- Password reset flow: ensure `/reset-password` requires `type=recovery` hash and clears session after update.
- Google OAuth: confirm redirect URLs allowlist is tight (no wildcards).

---

## Phase 6 — Infrastructure & ongoing guardrails 🟢

- **Cloudflare Worker** (`docs/cloudflare-worker-current.js`): audit for header injection, SSRF in `/cf-img?url=` (must allowlist hosts — only R2/cdn), cache poisoning via Vary headers.
- **CSP header**: add a strict Content-Security-Policy via the Worker (script-src 'self' + known CDNs, frame-ancestors 'self', object-src 'none').
- **Security headers**: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- **Dependency scan**: run `code--dependency_scan` + fix high/critical CVEs.
- **Secret rotation**: rotate every secret listed in `fetch_secrets` after fixes ship (WhatsApp, Razorpay, Cashfree, Meta CAPI, service role).
- **Logging**: ensure no secret/token/PII is logged in edge functions or `error_logs`.
- **CI guardrail**: add a lightweight grep-based pre-commit check that fails on `service_role_key`, hardcoded JWTs, `USING (true)` in migrations, `dangerouslySetInnerHTML`.

---

## Deliverables per phase

Each phase produces:
1. List of files/migrations changed
2. A short "what an attacker could have done before vs now" note
3. A re-run of `security--run_security_scan` + Supabase linter showing 0 errors

## Technical notes

- All DB changes go through `supabase--migration` (DROP-first for any function arg changes, per project rule).
- RLS changes will include matching `GRANT` / `REVOKE` in the same migration.
- Edge function changes deploy automatically.
- Worker changes require manual deploy by user (per project rule) — I'll list exact diff.

## Order of execution

Phase 1 (1 batch, ~6 edge functions + 1 migration + 1 component) → Phase 2 (grouped by 10 functions per batch) → Phase 3 (1 migration) → Phase 4 (frontend sweep) → Phase 5 (auth) → Phase 6 (worker + CI). After each phase: re-scan + report.

---

Approve and I'll start with Phase 1. If you want to reorder (e.g. do auth hardening first), tell me.
