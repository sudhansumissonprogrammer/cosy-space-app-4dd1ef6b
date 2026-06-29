
# Phase 1 — Shared ShopBanao WhatsApp Platform

Strict rule for this phase: **nothing is deleted**. Every existing per-store WhatsApp file, route, table, edge function, and UI block stays in the repo. We add a feature flag and a thin "platform mode" layer on top. Flipping the flag in Phase 2 brings the existing merchant system back online without code changes.

---

## 1. The single feature flag

Source of truth: `platform_config.whatsapp_mode` (text, one of `platform_only` | `dual_mode` | `merchant_only`). Default `platform_only`.

- Server reads it inside edge functions directly from `platform_config`.
- Client reads it via a new public RPC `get_whatsapp_mode()` (returns just the string, no secrets), cached in React Query for 10 min. Exposed through a tiny hook `useWhatsAppMode()`.
- Convenience helper `isPlatformOnly()` used by every gate.

No env var, no rebuild needed to flip — admin toggles it from the new admin page.

---

## 2. Database changes (one migration)

Add columns to `platform_config` (table already holds `wa_phone_number_id`, `wa_access_token`, `wa_business_phone`):

- `whatsapp_mode text not null default 'platform_only'` (CHECK in trigger, not constraint)
- `wa_enabled boolean not null default false` (global kill switch)
- `wa_default_lang text default 'en'`
- `wa_min_cart_age_minutes int default 30`
- `wa_max_cart_age_hours int default 24`
- `wa_daily_cap_per_phone int default 1`

New table `platform_wa_templates` (admin-managed, one library for all stores):

- `name text primary key` (e.g. `abandoned_cart_v1`)
- `purpose text` — one of `abandoned_cart | order_confirmation | payment_received | order_shipped | order_delivered | review_request | marketing`
- `language text default 'en'`
- `body_preview text` (admin-only documentation of the approved Meta body)
- `variables text[]` (ordered: `{{1}}`,`{{2}}`,...)
- `is_active boolean default true`
- `created_at`, `updated_at`

New table `platform_wa_campaigns` (admin-only bulk sends):

- `id`, `name`, `template_name`, `audience_filter jsonb`, `status`, `scheduled_at`, `sent_count`, `failed_count`, `created_by`, timestamps.

New table `stores_wa_settings` (one row per store, **only field**: a single toggle):

- `store_id uuid pk references stores(id) on delete cascade`
- `platform_marketing_enabled boolean not null default true`
- `created_at`, `updated_at`

(Existing `whatsapp_config`, `whatsapp_templates`, `whatsapp_bulk_campaigns`, `whatsapp_scheduled`, `whatsapp_messages`, `whatsapp_optouts`, `whatsapp_orders` stay untouched. We only ADD.)

Make `whatsapp_messages.store_id` nullable (platform sends with no store).
Add `whatsapp_messages.sent_via text default 'merchant'` (`platform` | `merchant`) so Phase 2 can split reporting.
Add `whatsapp_messages.template_name text` and `abandoned_cart_id` already exists.

New RPCs (security definer, admin-only where noted):

- `get_whatsapp_mode()` — public, returns text.
- `admin_get_platform_wa_config()` — admin, returns config without exposing token raw (masked).
- `admin_update_platform_wa_config(jsonb)` — admin only.
- `admin_upsert_platform_template(...)` / `admin_list_platform_templates()` — admin only.
- `set_store_platform_marketing(_store_id uuid, _enabled boolean)` — owner-of-store OR admin.
- `get_store_platform_marketing(_store_id uuid)` — owner OR admin.

All new tables get the standard GRANT + RLS block from the project rules.

---

## 3. Edge functions

**Add (new):**

- `wa-platform-send` — single sender used by automation + admin test. Always reads `platform_config.wa_*`. Enforces:
  - `wa_enabled = true`
  - target phone not in `whatsapp_optouts`
  - if call originates from automation, the source store has `stores_wa_settings.platform_marketing_enabled = true`
  - daily-per-phone cap
  - logs to `whatsapp_messages` with `sent_via='platform'`
- `wa-cart-recovery-cron` — every 10 min. Selects unrecovered carts in the window, sends `abandoned_cart_v1` via `wa-platform-send`. Marks `recovery_sent_at`. Skips stores that flipped their toggle off, skips opt-outs, idempotent.
- `wa-order-event` — invoked by `place-order`, payment webhooks, and shipping update points. Switches template by event type (`order_confirmation_v1`, `payment_received_v1`, `order_shipped_v1`, `order_delivered_v1`). Re-uses `wa-platform-send`. Single entry point so Phase 2 only swaps the sender.
- `wa-campaign-runner` — admin-triggered batch. Reads `platform_wa_campaigns`, expands audience, calls `wa-platform-send` in chunks of 100 with backoff.

**Modify (additive, no deletes):**

- `whatsapp-send` (existing, per-store) — at the top, read `whatsapp_mode`. If `platform_only`, return `403 {code:"merchant_wa_disabled"}` immediately. Existing code path preserved for `dual_mode`/`merchant_only`.
- `whatsapp-templates` (existing) — same gate. In `platform_only` returns "disabled in Phase 1".
- `whatsapp-webhook` (existing) — keep handling delivery receipts for merchant sends. ADD: if inbound is for the platform number (`phone_number_id` matches `platform_config.wa_phone_number_id`), insert into `whatsapp_optouts` with `store_id=null` for STOP/UNSUBSCRIBE, and update platform message statuses. Verify `X-Hub-Signature-256` (already on roadmap from .lovable/plan.md Phase 2 #10).
- `place-order`, `cashfree-webhook`, `payu-webhook`, `razorpay-verify`, shipping update flows — add a single fire-and-forget call to `wa-order-event`. Wrapped in try/catch so payment flow never fails because of WA.

`supabase/config.toml`: append `verify_jwt = false` for `wa-cart-recovery-cron` and `wa-platform-send` when called internally (use a `CRON_SECRET` header check inside instead).

---

## 4. Frontend — gating, not deletion

### 4a. Hook + helper

- `src/hooks/useWhatsAppMode.ts` (new) — React Query around `get_whatsapp_mode`, returns `{ mode, isPlatformOnly, isMerchantUiHidden }`.

### 4b. Sidebar (`src/components/AppSidebar.tsx`)

- Keep the existing "WhatsApp Marketing" entry import. Wrap the item so when `isPlatformOnly`, label changes to **"WhatsApp Marketing"** and links to a NEW lightweight page `StoreWhatsAppSimple.tsx`. In other modes, original route is used.

### 4c. New store page `src/pages/StoreWhatsAppSimple.tsx`

- Only UI element: a single toggle "Enable ShopBanao Marketing" backed by `set_store_platform_marketing`. Plus a small read-only panel listing what's automated (cart recovery, order confirmation, etc.) and a link to "View message history" → reuses the existing read-only message list component filtered to this store's `whatsapp_messages` rows.
- Existing `WhatsAppMarketing.tsx` is NOT removed and NOT routed in `platform_only`. Route handled via conditional in `AuthRoutes.tsx`:

  ```tsx
  <Route path="stores/:storeSlug/whatsapp" element={
    <WhatsAppGate
      platform={<StoreWhatsAppSimple/>}
      merchant={<WhatsAppMarketing/>}
    />
  }/>
  ```

  `WhatsAppGate` reads the mode and renders one child. Both imports stay (lazy), so Phase 2 just flips the flag.

### 4d. Abandoned Carts page (`src/pages/StoreAbandonedCarts.tsx`)

- Keep all existing UI. Add a read-only status column showing `recovery_status` ("Sent by ShopBanao" / "—"). The "Send WhatsApp" buttons (currently commented out) stay commented; in `platform_only`, surface a tiny note: "Automatic recovery is on — managed by ShopBanao."

### 4e. Store Settings

- Hide any WhatsApp-credentials sub-tab when `isPlatformOnly`. Code stays in file; just `{!isPlatformOnly && <WhatsAppCredentialsTab/>}`.

### 4f. Admin page (`src/pages/admin/AdminWhatsApp.tsx`)

- Keep the existing 4 tabs (`AdminChatTab`, `AdminBulkTab`, `AdminTemplatesTab`, `AdminStatsTab`) — they stay in the repo.
- Add a NEW first tab **"Platform"** containing:
  - Mode selector (`platform_only` / `dual_mode` / `merchant_only`) with confirmation.
  - Global kill switch (`wa_enabled`).
  - Credentials form (phone number id, access token masked, business phone, app secret, default lang).
  - Cart-recovery window inputs (min minutes, max hours, daily cap per phone).
  - Test-send box (phone + template + vars).
  - Health: webhook last-seen, last cron run, balance/quality (if available).
- Add a NEW second tab **"Platform Templates"** — CRUD over `platform_wa_templates`.
- Add a NEW third tab **"Platform Campaigns"** — CRUD over `platform_wa_campaigns` + "Run now".
- Add a NEW fourth tab **"Opt-outs"** — list of `whatsapp_optouts`, manual add/remove.
- Existing Chat / Bulk / Templates / Stats tabs are **hidden** (`{!isPlatformOnly && ...}`) but remain in code.

### 4g. `src/lib/whatsappAutomation.ts`

- Keep file. Wrap each function with: if `isPlatformOnly`, call `wa-order-event` edge function instead of the merchant-cred path. Both branches preserved.

---

## 5. Files touched (no deletions)

```text
NEW   src/hooks/useWhatsAppMode.ts
NEW   src/components/whatsapp/WhatsAppGate.tsx
NEW   src/pages/StoreWhatsAppSimple.tsx
NEW   src/components/admin/whatsapp/AdminPlatformTab.tsx
NEW   src/components/admin/whatsapp/AdminPlatformTemplatesTab.tsx
NEW   src/components/admin/whatsapp/AdminPlatformCampaignsTab.tsx
NEW   src/components/admin/whatsapp/AdminOptOutsTab.tsx
NEW   supabase/functions/wa-platform-send/index.ts
NEW   supabase/functions/wa-cart-recovery-cron/index.ts
NEW   supabase/functions/wa-order-event/index.ts
NEW   supabase/functions/wa-campaign-runner/index.ts
NEW   migration: platform_config cols + stores_wa_settings + platform_wa_templates
                + platform_wa_campaigns + RPCs + grants + RLS

EDIT  src/routes/AuthRoutes.tsx                      (wrap /whatsapp route in WhatsAppGate)
EDIT  src/components/AppSidebar.tsx                  (label/icon stays, gate target)
EDIT  src/pages/admin/AdminWhatsApp.tsx              (prepend Platform tabs, hide old ones in platform_only)
EDIT  src/pages/StoreAbandonedCarts.tsx              (read-only recovery status badge + banner)
EDIT  src/pages/StoreSettings.tsx                    (hide WA credentials section)
EDIT  src/lib/whatsappAutomation.ts                  (dispatch to platform sender in platform_only)
EDIT  supabase/functions/whatsapp-send/index.ts      (early return if platform_only)
EDIT  supabase/functions/whatsapp-templates/index.ts (early return if platform_only)
EDIT  supabase/functions/whatsapp-webhook/index.ts   (handle platform number inbound)
EDIT  supabase/functions/place-order/index.ts        (fire wa-order-event)
EDIT  supabase/functions/cashfree-webhook/index.ts   (fire wa-order-event on paid)
EDIT  supabase/functions/payu-webhook/index.ts       (fire wa-order-event on paid)
EDIT  supabase/functions/razorpay-verify/index.ts    (fire wa-order-event on paid)
EDIT  supabase/config.toml                           (verify_jwt entries for new fns)
INSERT pg_cron schedule for wa-cart-recovery-cron every 10 min

UNTOUCHED (Phase 2 assets, kept in repo):
  src/pages/WhatsAppMarketing.tsx
  src/components/admin/whatsapp/AdminChatTab.tsx
  src/components/admin/whatsapp/AdminBulkTab.tsx
  src/components/admin/whatsapp/AdminTemplatesTab.tsx
  src/components/admin/whatsapp/AdminStatsTab.tsx
  Tables: whatsapp_config, whatsapp_templates, whatsapp_bulk_campaigns,
          whatsapp_scheduled, whatsapp_orders
  Edge fns: whatsapp-send, whatsapp-templates (gated, not deleted)
```

---

## 6. Automation routing diagram

```text
checkout / payment / shipping event
            │
            ▼
   whatsappAutomation.ts ──► wa-order-event ──► wa-platform-send ──► Meta Cloud API
            │                                          ▲
            │                                          │ (Phase 2: branch on whatsapp_mode)
            └──► (Phase 2 path) whatsapp-send (merchant creds)

pg_cron every 10 min ──► wa-cart-recovery-cron ──► wa-platform-send

admin → AdminPlatformTab → wa-platform-send (test)
admin → Campaigns → wa-campaign-runner → wa-platform-send
```

Only `wa-platform-send` talks to Meta. Phase 2 adds the merchant branch inside that one file.

---

## 7. Secrets required

- `PLATFORM_WA_PHONE_NUMBER_ID`, `PLATFORM_WA_ACCESS_TOKEN`, `PLATFORM_WA_BUSINESS_PHONE`, `META_APP_SECRET`, `CRON_SECRET`.
- Stored via secrets tool (token never in DB plaintext; `platform_config.wa_access_token` becomes nullable cache only for display masking — actual send uses the secret).

---

## 8. Testing plan

1. **Migration** dry-run on dev DB. Confirm RLS + GRANT.
2. **Mode flag**: flip `whatsapp_mode='merchant_only'` → existing `WhatsAppMarketing.tsx` loads, sidebar shows old item. Flip back to `platform_only` → simple toggle page loads. Proves nothing is deleted.
3. **Admin Platform tab**: save credentials, send a test message to a real phone, verify delivery + row in `whatsapp_messages` with `sent_via='platform'`.
4. **Templates**: create `abandoned_cart_v1`. Trigger a fake abandoned cart (`abandoned_carts` insert with phone). Wait for cron OR call cron function manually. Verify message received, `recovery_sent_at` set, idempotent on second run.
5. **Order events**: place a COD order on a test store with the store toggle ON → expect `order_confirmation_v1` delivered. Toggle OFF on the store → next order produces no message but order still succeeds.
6. **Opt-out**: reply STOP → row appears in `whatsapp_optouts(store_id=null)`. Re-trigger automation for same phone → skipped.
7. **Kill switch**: set `wa_enabled=false` → every channel (cron, orders, campaigns, test send) returns "disabled".
8. **Failure isolation**: break Meta token → payment + checkout still succeed; failed rows logged.
9. **Daily cap**: send twice to same phone within 24h via cron → second is skipped.
10. **Webhook signature**: send forged webhook → rejected 401.

---

## 9. Rollout

1. Ship migration + new edge functions with `wa_enabled=false`.
2. Add secrets, save platform credentials, create one template, flip kill switch ON for a single pilot store (toggle their `stores_wa_settings.platform_marketing_enabled=true`, everyone else OFF).
3. Watch logs for 24 h.
4. Enable for all stores by default (`stores_wa_settings.platform_marketing_enabled` is already `true` by default).
5. Phase 2 work begins by setting `whatsapp_mode='dual_mode'` — no rewrites needed.

---

## Open questions before build

1. **Default per-store state**: `platform_marketing_enabled` defaults to `true` so every existing store opts in immediately, or `false` so each merchant must opt in? (Recommend `true`, with a one-time email/notification.)
2. **Template names**: confirm the 6 names listed (`abandoned_cart_v1`, `order_confirmation_v1`, `payment_received_v1`, `order_shipped_v1`, `order_delivered_v1`, `review_request_v1`) — we'll seed them as inactive rows; you fill the approved Meta names later.
3. **Branding in template body**: do we hard-code "Sent by ShopBanao on behalf of {{store_name}}" footer, or pure `{{store_name}}` only? Affects how the templates are submitted to Meta.
4. **Phase-1 message history for merchants**: show the merchant their own platform-sent messages (read-only) inside `StoreWhatsAppSimple`, or hide entirely? (Recommend show read-only — useful for support.)
