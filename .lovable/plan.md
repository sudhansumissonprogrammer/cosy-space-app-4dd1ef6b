# Phase 1.5 — Production Hardening Before Merchant Onboarding

Build on the Phase 1 shared platform without removing anything. Eight focused upgrades, then a controlled 5–10 store pilot.

---

## 1. Merchant Branding in Every Template

Every platform send must carry the store's identity, not "ShopBanao".

- Extend `wa-platform-send` to accept `store_id` and auto-resolve branding vars from `stores`: `{{store_name}}`, `{{store_phone}}`, `{{store_website}}` (full URL from slug/custom domain), `{{order_link}}`, `{{customer_name}}`.
- New helper `_shared/wa-branding.ts` → `resolveBrandingVars(admin, store_id, extra)` returns the ordered `template_params` array based on the template's `variables[]` definition.
- `platform_wa_templates.variables` becomes the contract; each template declares the variable order it expects. `wa-cart-recovery-cron`, `wa-order-event`, `wa-campaign-runner` all go through the resolver — no hand-built param arrays.
- Admin UI: show a "Branding preview" panel in `AdminPlatformTemplatesTab` rendering the body with a sample store's values.

## 2. Seed the Full Template Library

Seed all 10 templates as inactive rows in `platform_wa_templates` with documented body previews and variable lists. Admin activates each one as the matching Meta template is approved.

```
abandoned_cart_v1, order_confirmation_v1, payment_success_v1,
order_shipped_v1, order_delivered_v1, review_request_v1,
coupon_offer_v1, festival_sale_v1, welcome_customer_v1, back_in_stock_v1
```

Hook points wired now (fire only if the template is `is_active=true`):
- `welcome_customer_v1` → first storefront signup (storefront-auth side effect).
- `payment_success_v1` → existing payment webhooks (already calling `wa-order-event`).
- `back_in_stock_v1` → new `wa-back-in-stock-cron` reading a small `back_in_stock_waitlist` table (added now, populated by a "Notify me" button later).
- `review_request_v1` → cron 5 days after `order_delivered`.

## 3. Campaign Audience Segments

Replace the current "all customers" filter with a typed segment selector.

- New SQL view `customer_segments_v1` aggregating per `storefront_customer`: total_orders, total_spent, last_order_at, has_abandoned_cart, last_active_at.
- `platform_wa_campaigns.audience_filter jsonb` schema:
  ```json
  { "segment": "vip" | "with_orders" | "no_orders" | "high_value" | "abandoned_cart" | "recent_30d" | "inactive_90d" | "all", "store_ids": ["..."] | null, "min_spent": 0, "max_spent": null }
  ```
- `wa-campaign-runner` translates segment → SQL using a security-definer RPC `expand_campaign_audience(filter jsonb, limit int, offset int)`.
- Admin UI: segment dropdown + live "estimated recipients" count before send.

## 4. Send Queue (no direct sends from campaigns/cron)

- New table `wa_send_queue (id, store_id, recipient_phone, template_name, params jsonb, priority int, scheduled_at, attempts int default 0, max_attempts int default 4, status text default 'pending', last_error text, locked_until timestamptz, created_at)`.
- Producers: `wa-cart-recovery-cron`, `wa-campaign-runner`, `wa-order-event` insert rows instead of calling Meta directly. (Test-send from admin still calls `wa-platform-send` directly.)
- New worker `wa-queue-worker` invoked every 1 min by pg_cron:
  - Claims up to N rows with `SELECT … FOR UPDATE SKIP LOCKED` + `locked_until = now()+2min`.
  - Calls `wa-platform-send` with `x-cron-secret`.
  - Marks `sent` / schedules retry on failure.
- Throughput cap: configurable in `platform_config` (`wa_queue_batch_size`, default 50/min).

## 5. Retry with Backoff

- Backoff schedule: 1m → 5m → 30m → 2h → `failed` (4 attempts).
- Classify Meta errors in `wa-platform-send` response so the queue worker can decide:
  - Transient (rate limit, 5xx, network) → retry.
  - Permanent (invalid number, template paused, opted-out) → mark `failed` immediately, log reason.
- Surface `last_error` + attempt count in the admin queue view.

## 6. Analytics Tab

New `AdminPlatformAnalyticsTab` driven by SQL views/RPCs:

- `wa_platform_metrics_daily` view: sent, delivered, read, replied, failed, opt-outs.
- `wa_cart_recovery_metrics` RPC: carts targeted, messages delivered, carts recovered (orders within 48h with same phone), recovered revenue, recovery %.
- `wa_campaign_metrics` per `platform_wa_campaigns.id`: sent, delivered, read, CTR (link clicks if we add click tracking later), replies, attributed orders, attributed revenue.
- KPIs on top: Recovered Revenue (₹), Recovered Orders, Recovery %, Delivery %, Read %, Reply %, Failed %.
- Required wiring: `whatsapp-webhook` already updates statuses; add `replied_at` timestamp on inbound and a `recovered_order_id` linker job that runs hourly to match orders ↔ recent abandoned-cart messages.

## 7. AI Campaign Writer (no chatbot)

New tab `AdminAICampaignWriterTab`. Merchant/admin enters a brief: "Diwali offer, 15% off, jewellery store".

- Edge fn `wa-ai-template-draft` calls the Lovable AI Gateway (`google/gemini-2.5-flash`) with a strict JSON schema response:
  ```json
  { "template_name": "diwali_15_off_v1", "headline": "...", "body": "...", "button_label": "Shop Now", "emoji_set": ["🪔","✨"], "coupon_code": "DIWALI15", "variables": ["{{1}}","{{2}}","{{3}}"], "category": "marketing" }
  ```
- "Save as draft template" inserts into `platform_wa_templates` with `is_active=false` so admin reviews → submits to Meta → activates.
- No chatbot, no streaming, no per-customer AI — strictly a template drafting helper.

## 8. Pilot Rollout (5–10 stores)

- Add `stores_wa_settings.pilot_cohort boolean default false`.
- `wa_enabled` global stays ON, but every producer (`wa-cart-recovery-cron`, `wa-order-event`, `wa-campaign-runner`) checks: if `platform_config.wa_pilot_mode = true`, only enqueue for stores where `pilot_cohort = true`.
- Admin tab toggle: "Pilot mode" + multi-select to mark cohort stores.
- After 7 days of clean metrics, flip `wa_pilot_mode = false` → all stores live.

---

## Technical section

### Migration (single file)

```sql
-- Branding + queue + analytics support
ALTER TABLE platform_config
  ADD COLUMN wa_queue_batch_size int NOT NULL DEFAULT 50,
  ADD COLUMN wa_pilot_mode boolean NOT NULL DEFAULT true;

ALTER TABLE stores_wa_settings
  ADD COLUMN pilot_cohort boolean NOT NULL DEFAULT false;

ALTER TABLE platform_wa_templates
  ADD COLUMN category text DEFAULT 'transactional',
  ADD COLUMN button_label text,
  ADD COLUMN headline text;

ALTER TABLE whatsapp_messages
  ADD COLUMN replied_at timestamptz,
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN read_at timestamptz,
  ADD COLUMN recovered_order_id uuid REFERENCES orders(id);

-- Queue
CREATE TABLE wa_send_queue (...);
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_send_queue TO service_role;
ALTER TABLE wa_send_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all ON wa_send_queue FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Back-in-stock waitlist
CREATE TABLE back_in_stock_waitlist (...);

-- Segments view
CREATE VIEW customer_segments_v1 AS (...);

-- RPCs: expand_campaign_audience, get_wa_platform_kpis, get_wa_recovery_metrics
```

### New edge functions

```
supabase/functions/wa-queue-worker/index.ts        (cron, 1 min)
supabase/functions/wa-back-in-stock-cron/index.ts  (cron, hourly)
supabase/functions/wa-recovery-attribution/index.ts (cron, hourly — link orders → cart msgs)
supabase/functions/wa-ai-template-draft/index.ts   (admin auth)
supabase/functions/_shared/wa-branding.ts          (resolveBrandingVars)
```

### Edited edge functions

- `wa-platform-send`: accept `store_id`, auto-resolve branding vars when `template_params` omitted; return structured error class (`transient` | `permanent`).
- `wa-cart-recovery-cron`, `wa-campaign-runner`, `wa-order-event`: enqueue instead of direct send; honor `wa_pilot_mode` + `pilot_cohort`.
- `whatsapp-webhook`: stamp `delivered_at`, `read_at`, `replied_at`.

### New / edited frontend

```
NEW  src/components/admin/whatsapp/AdminPlatformAnalyticsTab.tsx
NEW  src/components/admin/whatsapp/AdminQueueTab.tsx
NEW  src/components/admin/whatsapp/AdminAICampaignWriterTab.tsx
NEW  src/components/admin/whatsapp/AudienceSegmentPicker.tsx
NEW  src/components/admin/whatsapp/TemplateBrandingPreview.tsx
EDIT src/pages/admin/AdminWhatsApp.tsx               (add 3 tabs + pilot toggle)
EDIT src/components/admin/whatsapp/AdminPlatformTab.tsx
       (pilot mode toggle, queue batch size, cohort multi-select)
EDIT src/components/admin/whatsapp/AdminPlatformTemplatesTab.tsx
       (seed all 10, branding preview, AI-draft import)
EDIT src/components/admin/whatsapp/AdminPlatformCampaignsTab.tsx
       (segment picker, estimated audience count, queue-based runner)
```

### Cron schedule

```
*/1  *  *  *  *  wa-queue-worker
*/10 *  *  *  *  wa-cart-recovery-cron       (already)
0    *  *  *  *  wa-back-in-stock-cron
0    *  *  *  *  wa-recovery-attribution
```

### Secrets

No new secrets needed; reuses `CRON_SECRET`, existing platform WA creds, and `LOVABLE_API_KEY` for the AI writer.

---

## Build order (incremental, safe)

1. Migration + queue table + queue worker + retry classification.
2. Switch all three producers to enqueue. Verify deliveries unchanged.
3. Branding helper + reseed all 10 templates (inactive).
4. Segments view + RPC + segment picker.
5. Analytics views + RPCs + attribution cron + Analytics tab.
6. AI Campaign Writer edge function + tab.
7. Pilot mode flag + cohort selector. Enable for 5–10 stores.
8. After 7 days clean: flip `wa_pilot_mode = false`.

## Open questions

1. Pilot cohort — pick stores yourself or want me to suggest top 10 by recent abandoned-cart volume?
2. AI writer model — `google/gemini-2.5-flash` (fast, free during promo) or `google/gemini-2.5-pro` (higher quality)?
3. Recovery attribution window — 48h after message default, or 24h / 72h?
4. Click tracking — add a `wa.shopbanao.in/r/{token}` redirector now (for CTR) or defer to Phase 2?
