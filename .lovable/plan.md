

# Dual WhatsApp Marketing System: Storivo Marketing + Own Business API

## Overview

Add a mode selection to WhatsApp Marketing where store owners choose between:
1. **Storivo Marketing** (default) -- messages sent from the SaaS platform's own WhatsApp Business API number, zero setup required
2. **Own Business API** -- store owner configures their own Meta WhatsApp credentials (current behavior)

## Database Changes

**Add a column to `whatsapp_config` table** to track which mode the store uses:

```sql
ALTER TABLE public.whatsapp_config 
  ADD COLUMN IF NOT EXISTS marketing_mode text NOT NULL DEFAULT 'storivo';
-- Values: 'storivo' | 'own'
```

**Add a platform-level WhatsApp config** (Storivo's own credentials) to `platform_config`:

```sql
ALTER TABLE public.platform_config 
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text,
  ADD COLUMN IF NOT EXISTS wa_access_token text,
  ADD COLUMN IF NOT EXISTS wa_business_phone text;
```

This lets the super admin configure the SaaS-level WhatsApp credentials once.

## Edge Function Changes

**`whatsapp-send/index.ts`**: When sending a message, check the store's `marketing_mode`:
- If `'own'` -- use the store's `whatsapp_config` credentials (current behavior)
- If `'storivo'` -- use service-role client to read `platform_config` and send from the platform's WhatsApp number instead. If no store-level `whatsapp_config` row exists, auto-create one with mode `'storivo'`.

## Frontend Changes

**`WhatsAppMarketing.tsx` -- Mode Selection Screen**:
- When the page loads, show a selection screen with two cards before showing tabs:
  - **Card 1: "Storivo Marketing"** -- icon, description ("Messages sent from Storivo's number. No setup needed. Order confirmations, abandoned cart recovery, all automated."), CTA button
  - **Card 2: "Your Own WhatsApp Business API"** -- icon, description ("Use your own Meta WhatsApp number. Full control. Requires Meta Business setup."), CTA button
- If mode is already chosen, skip to the appropriate view:
  - `storivo` mode: Show a simplified dashboard (Auto, Stats tabs only -- no Setup/Chat needed since it's managed centrally). Show automations toggles (order confirmation, shipping, delivery, abandoned cart) that just enable/disable templates.
  - `own` mode: Show current full 8-tab dashboard as-is.
- Allow switching modes via a button in the header.

**`src/lib/whatsappAutomation.ts`**: Update `sendOrderWhatsApp` and `sendAbandonedCartWhatsApp`:
- If no store-level config exists, check if store has `marketing_mode = 'storivo'` (or default to storivo). If so, still call `whatsapp-send` edge function -- the edge function handles credential resolution.
- Remove the early return when no config found; instead, always attempt sending and let the edge function decide.

## Storivo Marketing Simplified View

For stores using Storivo mode, show:
- **Automations tab**: Toggle order confirmation, shipping update, delivery, abandoned cart messages on/off. Edit message templates with variable placeholders.
- **Stats tab**: View message history and delivery stats.
- No Setup (managed by platform), no Chat (messages come from platform number), no Bulk/Segments/Schedule (platform-level feature).

## Admin Settings

Add a section in **Admin Settings** (`src/pages/admin/AdminSettings.tsx`) for the super admin to configure the platform WhatsApp credentials (phone_number_id, access_token, business_phone).

## Secret Management

The platform-level WhatsApp access token will be stored in `platform_config` table (accessible only via service role). The edge function reads it server-side, so no client exposure.

## Flow Summary

```text
Store Owner clicks "WhatsApp Marketing"
  → Mode Selection Screen
     ├── "Storivo Marketing" → simplified automations dashboard
     │     └── Messages sent via platform credentials
     └── "Own Business API" → full 8-tab dashboard (current)
           └── Messages sent via store's own credentials

Edge Function (whatsapp-send):
  → Check store's marketing_mode
  → mode='own' → use store credentials
  → mode='storivo' → use platform credentials from platform_config
```

