# WhatsApp Template Studio — Submit to Meta + Custom Builder

Goal: stop pasting templates into Meta by hand. Build (a) a one-click **Submit to Meta** action for every template row, and (b) a **Template Builder** so you can author new templates (any language, any category) from inside `/admin/whatsapp` and ship them with one click.

---

## 1. What this gives you

- One **"Submit to Meta"** button per template → posts to Graph API with your saved token, stores `meta_template_id`, flips `meta_status` automatically.
- A **"+ New template"** dialog → guided builder (category, language, header, body with `{{1}} {{2}}` variables, footer, up to 2 buttons). Live WhatsApp-style preview. Validates Meta rules before submit so you don't get rejected for trivial reasons.
- A **"Resubmit"** action for rejected/edited templates (Meta requires a new name or `edit` call; we handle both).
- Hourly sync already exists (`wa-template-sync-hourly`) — it will pick up approval status without you doing anything.
- **No more JSON copy-paste, no more Meta UI for routine work.** You still log into Meta only for first-time WABA setup.

---

## 2. Database changes (1 migration)

Extend `platform_wa_templates` with the fields the builder/submitter need:

| New column | Purpose |
|---|---|
| `category` | UTILITY / MARKETING / AUTHENTICATION |
| `header_type` | NONE / TEXT / IMAGE |
| `header_text` | header copy when type=TEXT |
| `body_text` | the actual template body with `{{1}}…{{n}}` |
| `buttons` (jsonb) | `[{type:'URL', text:'View Order', url:'https://{{1}}'}]` |
| `meta_template_id` | id returned by Graph API |
| `meta_rejected_reason` | last rejection reason from Meta |
| `submitted_at` | last submit timestamp |
| `created_by` | admin user id |

Existing columns kept: `name`, `language`, `variables`, `footer_text`, `button_url_pattern`, `meta_status`, `paused`, `pause_reason`, `is_active`.

Backfill `body_text` / `category` / `buttons` for the 3 live templates (`order_confirmation_v2`, `order_shipped_v2`, `abandoned_cart_v2`) so the new UI shows them correctly.

---

## 3. New edge function — `wa-template-submit`

Single endpoint that does all 4 lifecycle actions:

- `action: 'create'` → `POST graph.facebook.com/v21.0/{WABA_ID}/message_templates`
- `action: 'edit'` → `POST graph.facebook.com/v21.0/{TEMPLATE_ID}` (only body/footer/buttons; name+category are immutable per Meta)
- `action: 'delete'` → `DELETE graph.facebook.com/v21.0/{WABA_ID}/message_templates?name=...`
- `action: 'refresh'` → fetches current status for one template (instant feedback after Submit, doesn't wait for the hourly cron)

Auth: admin-only (existing `has_role(user_id,'admin')` gate, same pattern as `wa-platform-send`).

Inputs validated with Zod. Builds the Meta `components[]` array from our DB row (HEADER + BODY + FOOTER + BUTTONS). Stores `meta_template_id`, `meta_status`, `meta_rejected_reason`, `submitted_at` back on the row.

Needs one new secret: `META_WABA_ID` (WhatsApp Business Account ID — different from phone-number-id). Token reuses existing `wa_access_token` from `platform_config`.

---

## 4. UI — `/admin/whatsapp` → Templates tab

Rebuild `AdminPlatformTemplatesTab.tsx` with three surfaces:

**a. List view** (table)
- Columns: name · category · language · meta_status (color chip) · last submitted · actions
- Row actions: Edit · Submit to Meta · Refresh status · Pause/Resume · Delete (Meta + DB)
- Status chips: PENDING (amber), APPROVED (green), REJECTED (red, click → shows reason), PAUSED (gray)

**b. Builder dialog** (`+ New template`)

```text
┌─────────────────────────────┬──────────────────────────┐
│ FORM                        │ LIVE PREVIEW             │
│ ─ Name (snake_case)         │  ┌────────────────────┐  │
│ ─ Language (en/hi/…)        │  │  📱 WhatsApp       │  │
│ ─ Category (UTIL/MKT/AUTH)  │  │  ─────────────     │  │
│ ─ Header (none/text/image)  │  │  Header line       │  │
│ ─ Body  [textarea]          │  │  Body with         │  │
│   helper: insert {{var}}    │  │  resolved {{1}}    │  │
│ ─ Footer (≤60 chars)        │  │  Footer            │  │
│ ─ Buttons (0–2)             │  │  [ View Order ]    │  │
│   • URL  • Quick reply      │  └────────────────────┘  │
│ ─ Sample values for vars    │                          │
│   (used in preview + Meta)  │  ⚠ Validation hints     │
└─────────────────────────────┴──────────────────────────┘
     [ Save draft ]   [ Save & Submit to Meta ]
```

Client-side validation before submit (catches 90% of Meta rejections):
- Body ≤ 1024 chars, header ≤ 60, footer ≤ 60, button text ≤ 25
- Variables must be sequential `{{1}}, {{2}}, …`
- No URL/phone in body unless it's a variable inside a button
- Marketing templates must include opt-out language in footer (we auto-append "Reply STOP to opt out" if missing)
- Snake_case + lowercase name (Meta requirement)

**c. Detail drawer** — clicking a template opens history: submit timestamps, Meta status transitions, rejection reasons, last 20 sends using this template, click-through rate from `wa_link_clicks`.

---

## 5. Lifecycle wiring (so nothing is half-done)

- After **Submit** → call `refresh` once after 5s for instant feedback; rely on hourly sync after that.
- On **Approved** → row becomes selectable in `wa-order-event` / campaigns (already gated by `meta_status==='approved'` in `wa-platform-send`).
- On **Rejected** → row auto-pauses (`paused=true`), reason shown in UI, Edit becomes the only enabled action.
- On **Paused by Meta** (via webhook `message_template_status_update` → already handled in `whatsapp-webhook`) → same UI treatment; `wa-platform-send` already refuses to send.
- On **Delete** → soft-delete locally (`is_active=false`) + hard delete on Meta. Prevents accidental data loss in our analytics tables.

---

## 6. Safety / guardrails

- Admin role gate on every action (already enforced via `has_role`).
- Rate-limit submits: max 10 template ops / hour / admin (Meta throttles aggressive submitters and can flag the WABA).
- Master kill switch (`wa_enabled`) still respected — Submit works even when sender is off, since approval is independent of sending.
- Never log the access token. Errors from Meta are sanitized before storing in `meta_rejected_reason`.
- Audit row written to `wa_health_log` for every create/edit/delete.

---

## 7. Files touched

**New**
- `supabase/functions/wa-template-submit/index.ts`
- `src/components/admin/whatsapp/TemplateBuilderDialog.tsx`
- `src/components/admin/whatsapp/TemplatePreview.tsx`
- `src/components/admin/whatsapp/TemplateDetailDrawer.tsx`
- `src/lib/wa-template-validate.ts` (shared validator: client + edge)

**Edited**
- `src/components/admin/whatsapp/AdminPlatformTemplatesTab.tsx` (rebuild)
- 1 migration (schema + backfill)

**Untouched**
- `wa-platform-send`, `wa-order-event`, `wa-cart-recovery-cron`, `whatsapp-webhook`, all triggers — the sending pipeline doesn't change.

---

## 8. Secrets to add (one-time, after plan approval)

- `META_WABA_ID` — find it in Meta Business Manager → WhatsApp Accounts → your WABA → top of page. Same place you got `META_WHATSAPP_TOKEN`.

That's the only new secret. Token, phone-number-id, and verify-token are already saved.

---

## 9. Out of scope (call it out so we don't sprawl)

- Media header uploads (image/video templates) → phase 2; current 3 templates are text-only.
- Carousel / catalog templates → phase 2.
- Multi-language auto-translation → phase 2 (you'll create Hindi versions manually in the builder for now; 2 minutes per template).
- Per-merchant custom templates → still later, after single-shared sender is fully proven.

---

## 10. Acceptance test

After build, you should be able to:
1. Open `/admin/whatsapp` → Templates → see 3 existing templates with full body/footer/buttons.
2. Click **Submit to Meta** on `order_confirmation_v2` → status flips to PENDING within 2s → APPROVED within ~5 min (Meta side).
3. Click **+ New template**, fill the builder for a Hindi `order_confirmation_hi` → preview matches what WhatsApp will render → **Save & Submit** → row appears with PENDING.
4. Pause / resume / delete each works and is reflected in Meta within 30s.
5. Send a test order → `wa-platform-send` only picks templates where `meta_status='approved'` and `paused=false` (already true today; verified end-to-end after a real approval lands).

Ready to build on approval.