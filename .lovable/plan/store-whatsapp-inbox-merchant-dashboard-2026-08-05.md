# Store WhatsApp Inbox (merchant dashboard)

Give every store owner the same WhatsApp inbox the platform admin has — but scoped strictly to their own store's conversations, with real server-side pagination so it stays fast no matter how many messages exist.

## What the store owner gets

- A new **Inbox** tab on the store's WhatsApp page (`/dashboard/stores/:storeSlug/whatsapp`), next to the existing Automations toggles.
- Left: conversation list (customer name/phone, last message preview, time, unread badge), searchable by name or number, loading 30 threads at a time with "Load older" as you scroll.
- Right: WhatsApp-style thread with all past messages for that number — templates rendered with friendly labels (Order confirmation, Cart reminder…), photos/voice notes/videos playable inline, delivery ticks (sent / delivered / read). Older messages load in pages of 40 as the owner scrolls up.
- Reply box for free-form text, active only inside WhatsApp's 24-hour window (same rule and explanatory banner as admin). Outside the window the box is disabled with a clear reason.
- Opening a thread marks it read; new incoming messages appear live.
- Everything is limited to numbers that belong to that store — a Serdiya owner sees only Serdiya conversations, including all history already in the system.

## Technical plan

### Database (one migration, security-definer RPCs)

Access rule in every function: `is_store_owner(_store_id) OR has_role(auth.uid(),'admin')`, else raise `forbidden`. This keeps admin-view-of-a-store working in the dashboard.

1. `store_wa_threads(_store_id uuid, _search text, _limit int, _offset int)` — groups `whatsapp_messages` for the store by counterpart phone (`sender_phone` for incoming, `recipient_phone` for outgoing), returning: phone, best-known name (ignoring the `there` placeholder), last message body/type/direction/status/created_at, unread count (`direction='incoming' AND status='received'`), `last_incoming_at`, and total thread count for paging. Matches on `store_id = _store_id OR inferred_store_id = _store_id` so orphan rows that were later attributed still surface.
2. `store_wa_thread_messages(_store_id uuid, _phone text, _before timestamptz, _limit int)` — keyset pagination (newest first, `created_at < _before`), returning id, direction, body, media_type, status, created_at.
3. `store_wa_mark_thread_read(_store_id uuid, _phone text)` — same body as `admin_wa_mark_thread_read` but store-scoped and owner-authorised.

Supporting index: `whatsapp_messages (store_id, created_at DESC)` and one on `inferred_store_id` if not already present, so both RPCs stay index-driven.

### Frontend

- Move `WaMediaBubble` from `src/components/admin/whatsapp/` to `src/components/whatsapp/` and re-export so both inboxes share it (the `wa-media` edge function already authorises store owners).
- New `src/components/whatsapp/StoreInbox.tsx` — the inbox UI, built from the admin chat markup but driven by the three RPCs instead of a 10k-row client fetch:
  - `useInfiniteQuery` for threads (30/page) and for messages (40/page, keyset by `created_at`).
  - Debounced search passed to the RPC (server-side, not client filtering).
  - Realtime subscription on `whatsapp_messages` filtered by `store_id=eq.<id>`; invalidates only the first thread page and the open thread.
  - Sending reuses `supabase.functions.invoke("wa-platform-send", { mode: "text", store_id, recipient_phone, message_body, message_type: "text_reply" })`, which already permits store owners for text replies; optimistic bubble plus error toast with the real edge-function reason.
- `src/pages/StoreWhatsAppSimple.tsx` gains two tabs: **Inbox** (new component) and **Automations** (existing content), defaulting to Inbox. Store id comes from `useDashboardStore()`.
- Sidebar label/badge unchanged; no changes to the admin inbox behaviour.

### Out of scope

Sending templates/campaigns from the store inbox (owners keep using automations), and any change to how messages are ingested by the webhook.
