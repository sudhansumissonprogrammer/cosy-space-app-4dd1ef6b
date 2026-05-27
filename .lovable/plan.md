
# Remaining Security Hardening — Phased Plan

Deep scan complete. Below is everything left, ranked by risk and grouped into 5 phases. Each phase ends with a re-scan so we catch regressions before the next phase.

---

## Current open findings

| # | Finding | Severity | Storefront risk if fixed wrong |
|---|---|---|---|
| 1 | `products.cost_price` readable by any logged-in user (margin leak across tenants) | ERROR | Low — only "Authenticated view active products" policy is wrong; anon + owner policies stay |
| 2 | `store_shipping_config` `USING (true)` for authenticated | WARN | **High** — every cart/checkout page directly reads this table |
| 3 | `store_tax_config` `USING (true)` for authenticated | WARN | **High** — CheckoutPage reads it |
| 4 | `store_theme_config` `USING (true)` for authenticated | WARN | Low — anon policy already exists, theme hook still works |
| 5 | `stores_public` view = SECURITY DEFINER | ERROR | Medium — used in `App.tsx` storefront resolver |
| 6 | `store_payment_config_public` view = SECURITY DEFINER | ERROR | Medium — used by payment flow |
| 7 | ~30 SECURITY DEFINER functions executable by anon | WARN | Mixed — some MUST stay anon (e.g. `get_storefront_shell`), others are admin-only (`get_admin_stats`, `wallet_*`, `admin_*`) |
| 8 | `partner_notifications` realtime topic auth missing | WARN | None — partner UI only |
| 9 | `pg_net` extension in public schema | WARN | None — info |
| 10 | `partner_referral_clicks` / `customer_leads` INSERT with check=true | WARN | Both are intentional lead capture; mitigate with rate-limit only |

---

## Phase 1 — Margin leak (cost_price) [zero storefront risk]

The only policy that exposes `cost_price` cross-tenant is `"Authenticated can view active products"`. Storefronts read products via the anon policy + RPCs. Owner read works via `is_store_owner`.

**Migration:**
- `DROP POLICY "Authenticated can view active products" ON public.products;`
- Frontend: stop selecting `cost_price` in `useStorefrontProducts.ts` + `useInfiniteProducts.ts` (defense-in-depth — no owner data should travel to a shopper's browser anyway).

**Risk:** None. The anon policy still serves all storefront shoppers; owners still see everything.

---

## Phase 2 — Cross-tenant config read (shipping/tax/theme) [needs careful re-policy]

Today `store_shipping_config` has **no anon SELECT policy**, only "Authenticated true". That means anonymous shoppers' cart queries silently return empty rows. The right fix is **not** to delete the broad policy — that would break logged-in storefront customers. The right fix is:

**Migration:**
- Drop `"Authenticated can view shipping config"` / `"Authenticated can view tax config"` / `"Authenticated can view theme config"` (the `true` ones).
- Replace each with a **scoped public SELECT** policy:
  ```sql
  CREATE POLICY "Public can view <x> for active stores"
  ON public.store_<x>_config FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = store_id AND s.is_suspended = false));
  ```
- This is **safer than the current state** (anon shoppers will actually be able to read shipping rates now) and removes the cross-tenant warning (rows still scoped to non-suspended stores; shipping/tax/theme are display data the shopper must see anyway).
- Drop redundant `"Owners view own ..."` policies (covered by ALL).

**Risk:** Improves storefront, doesn't regress. We verify in preview by loading a storefront cart logged-out + logged-in.

---

## Phase 3 — SECURITY DEFINER views [App.tsx + payment flow touchpoints]

Two views: `stores_public`, `store_payment_config_public`. PG 15+ lets us recreate them with `security_invoker=true` so they enforce the caller's RLS instead of postgres'.

**Migration:**
- `ALTER VIEW public.stores_public SET (security_invoker = true);`
- `ALTER VIEW public.store_payment_config_public SET (security_invoker = true);`
- Verify the underlying tables have the right SELECT policies for anon (the views resolve to `stores` + `store_payment_config`, both of which need anon SELECT for active/non-suspended stores).
- If a view depends on RLS that doesn't permit anon, the storefront resolver in `App.tsx` falls back to `"stores"` already.

**Risk:** Medium. We re-deploy and check the homepage + a storefront subdomain load without errors. Rollback = re-set `security_invoker=false`.

---

## Phase 4 — SECURITY DEFINER function permissions [admin/internal only]

~30 SECURITY DEFINER functions are anon-executable. Classify and revoke:

| Function | Audience | Action |
|---|---|---|
| `get_storefront_shell`, `get_store_public`, `get_storefront_seo`, `get_product_page`, `get_category_page`, `get_store_payment_config`, `get_platform_config_public`, `get_store_public_email` | anon storefront | **KEEP** anon EXECUTE |
| `has_role`, `is_store_owner`, `is_partner_owner`, `is_storefront_customer`, `is_user_blocked`, `is_store_active`, `is_order_owner`, `is_store_owner_by_folder` | RLS helpers | **KEEP** anon EXECUTE (used inside policies) |
| `can_create_website_order`, `can_create_website_order_item` | RLS helpers | KEEP anon |
| `get_admin_*`, `get_dashboard_stats`, `get_store_wallet_summary`, `get_store_billing_state`, `get_store_usage_stats`, `get_store_views`, `get_store_as_admin`, `get_co_purchased_products`, `check_product_limit` | dashboard-only | REVOKE EXECUTE FROM anon |
| `enqueue_email`, `delete_email`, `cleanup_*`, trigger fns (`handle_*`, `guard_*`, `auto_assign_*`, `create_partner_commission_on_paid`) | internal only | REVOKE EXECUTE FROM anon, authenticated |

**Migration:** one big `REVOKE EXECUTE … FROM anon` block grouped by audience.

**Risk:** Medium. We must enumerate exactly which functions the storefront calls. I'll grep `supabase.rpc(` across the codebase before generating the migration and only revoke from functions never called by anon paths.

---

## Phase 5 — Realtime channel auth + rate-limits + extension housekeeping

- Add RLS policy on `realtime.messages` so partner-notification subscriptions are scoped to the partner UUID (channel topic must equal `partner:<auth.uid()-mapped-partner-id>`).
- Edge function `track-referral-click`: add per-IP rate limit (max 30/min per partner_code) — abuse mitigation, not a hard fix.
- `pg_net` extension move out of public schema — **defer** to a maintenance window; this requires patching every call site and isn't a real exploit, only a lint warning.
- Worker security headers + `/cf-img?url=` host allowlist — I prep the diff for `docs/cloudflare-worker-current.js`, you deploy when convenient.

---

## Execution order & safety

```text
Phase 1  → migration + 2 frontend selects   → re-scan → verify storefront loads
Phase 2  → migration only                    → re-scan → load cart logged-out + in
Phase 3  → migration only                    → re-scan → load storefront + payment
Phase 4  → migration only                    → re-scan → load dashboard + storefront
Phase 5  → migration + edge fn + worker diff → re-scan → final report
```

Each phase is a single migration + at most one frontend file. If any phase shows a regression, rollback is one-line.

## Approval

Say **"go phase 1"** and I'll start. I'll pause after each phase for you to verify ads + storefront before moving on.
