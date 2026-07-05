## Goal

Meter WhatsApp usage per store on the shared platform number and deduct from `store_wallets` when a template message is **delivered**. Use Meta's real billing unit — a **24-hour conversation window per recipient per category** — so 50 marketing messages to one number in 24 h = one ₹1 charge, not fifty.

## Pricing (default, admin-configurable)

| Category | Price per 24h conversation |
|---|---|
| Marketing | ₹1.00 |
| Utility | ₹0.30 |
| Authentication | ₹0.30 |
| Service (24h free-form replies) | ₹0.00 |

Stored in a new single-row `wa_pricing_config` table so we can change prices later without a deploy.

## Data model

**New table `wa_billing_conversations`** — one row per (store, recipient, category, 24 h window).
- `store_id`, `recipient_phone`, `category`
- `window_start` (delivered_at of first msg), `window_end` = window_start + 24h
- `message_count`, `first_message_id`, `last_message_id`
- `price_charged`, `charged_at`, `ledger_id` (FK → `store_wallet_ledger`)
- Partial unique index on (store_id, recipient_phone, category) `WHERE window_end > now()` — guarantees only one active window at a time.

**Reuse `store_wallet_ledger`** with new `kind='wa_conversation'`. `notes` (jsonb-in-text) carries category, masked phone, template name, message count.

**New table `wa_pricing_config`** — one row, admin-editable, holds four price columns + updated_by/at.

## How charging happens (atomic + idempotent)

1. **Trigger `wa_messages_charge_on_delivered`** — AFTER UPDATE on `whatsapp_messages`, fires only when `status` transitions `!= 'delivered' → 'delivered'` AND `direction = 'outgoing'`.
2. Trigger calls `charge_wa_conversation(store_id, recipient_phone, category, message_id, template_name)`.
3. Inside the function:
   - `pg_advisory_xact_lock(hashtext(store_id::text || phone || category))` — prevents race between two concurrent deliveries in same conversation.
   - Look up active window (`window_end > now()`).
   - **If active window exists** → increment `message_count`, update `last_message_id`, **no wallet change**.
   - **If none** → open new window (24 h), read price from `wa_pricing_config`, insert `store_wallet_ledger` (direction='debit', amount=price, balance_after=…), decrement `store_wallets.balance` + increment `total_charged`, store `ledger_id` back on the conversation row.

Category resolution: `platform_wa_templates.category` (already synced from Meta) for template sends; `service` for `message_type='text_reply'`; conservative fallback = `marketing`.

## Safety nets

- **Reconciler edge fn `wa-billing-reconcile`** — cron every 15 min, scans `whatsapp_messages` with `delivered_at IS NOT NULL` in last 30 h and calls the same charge function for any missing billing row. Idempotent (function early-exits on active window).
- **No retroactive charge** — start clean from deploy date. Existing delivered messages are not billed.
- **No hard gate at send time** in this iteration — negative balance allowed (user asked only for deduction). Optional follow-up: block marketing sends when balance ≤ 0.

## UI

**`src/pages/StoreWallet.tsx` — add "WhatsApp Usage" tab.**
- Top summary card for a selectable range (today / 7d / 30d): marketing conversations, utility conversations, total charged, messages delivered per category.
- Table below: individual conversations (recipient masked `98…4884`, category badge, window_start, message_count, price).
- Ledger entries with `kind='wa_conversation'` render inline in the existing wallet history list with a friendly label; click expands to show the recipient + message breakdown from `wa_billing_conversations`.

**Admin pricing screen** — `src/pages/admin/AdminWhatsApp.tsx` gets a small "Pricing" section to edit the 4 prices in `wa_pricing_config`.

## Edge-case correctness

| Case | Handled by |
|---|---|
| Two deliveries land in same ms | advisory lock in charge fn |
| Webhook fires "delivered" twice for same msg | trigger fires only on status transition, function is idempotent on active window |
| Message billed then later fails | never happens — `delivered` is terminal in Meta's flow |
| Store deleted mid-window | FK on delete cascade; ledger keeps a copy of notes |
| Shared number, wrong store attribution | none — `whatsapp_messages.store_id` is set by `wa-platform-send` at send time, unchanged by webhook |
| Missing template in `platform_wa_templates` | conservative fallback to `marketing` (user pays more, never less) |
| Webhook down / trigger missed | 15-min reconciler cron catches it |

## Deliverables (in order)

**Migration 1** — schema
- `wa_pricing_config` table + single default row (1.00 / 0.30 / 0.30 / 0.00), GRANTs, RLS (admin write, service_role all).
- `wa_billing_conversations` table + partial unique index + GRANTs, RLS (store owner read via `stores.owner_id`, service_role all).
- `charge_wa_conversation(...)` SECURITY DEFINER function.
- Trigger on `whatsapp_messages` for delivered transitions.
- Allow `kind='wa_conversation'` in `store_wallet_ledger` (no CHECK change needed if column is free-text).

**Edge function** — `wa-billing-reconcile` (cron every 15 min via pg_cron + net.http_post, using existing `cron_auth` secret pattern).

**Frontend**
- New "WhatsApp Usage" tab in `StoreWallet.tsx` with summary + conversations table.
- Pretty renderer for `kind='wa_conversation'` rows in existing wallet history.
- Admin pricing editor in `AdminWhatsApp.tsx`.

**No changes needed** to `wa-platform-send` or `wa-queue-worker` — attribution already correct; charging is purely webhook-driven.

## Out of scope for this iteration (flag for later)
- Hard-block sends when balance ≤ 0.
- Auto-recharge / low-balance WhatsApp alert to store owner.
- Bulk retroactive backfill of past deliveries.
- Per-template price overrides.

Ready to build once you approve.
