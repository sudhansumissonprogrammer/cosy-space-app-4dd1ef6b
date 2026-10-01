# AI "Ready-made Store in Minutes" WhatsApp Agent

## Goal
Everything happens inside WhatsApp — the person never visits shopbanao.in. They receive our marketing message (written later) with a "Create my store" button or reply. When they tap/reply, the ShopBanao AI agent on our WhatsApp Business number chats with them right there: brand name, what they sell, old store URL (optional), logo (send image, optional). The system then creates a complete store for their WhatsApp number and sends, in the same chat: store link, admin login link, login ID and a temporary password.

The marketing message itself is NOT part of this build.

## Flow

```text
WhatsApp marketing msg (later) with quick-reply button [Create my store]
                            │  tap / reply "store"  (opens 24h free-reply window)
                            ▼
        Incoming message -> our WhatsApp webhook -> AI agent (per-phone session)
                            ▼
        AI asks in chat, one question at a time (buttons/lists where possible)
          1. Brand name  -> checks subdomain free, suggests alternates as buttons
          2. What do you sell? (list message of categories + free text)
          3. Old store URL? (reply link or tap [Skip])
          4. Send your logo image (or tap [Skip] -> auto text logo)
          5. Your name (for About Us)
          6. Summary + buttons [Create my store] [Change something]
                            ▼
        Server: create account + store (one safe function)
                            ▼
        Chat: "Building your store..." (progress updates)
                            ▼
        Chat: store link, admin one-tap login link, login ID, temp password
```

## How the phone number is trusted
- The sender's number comes from WhatsApp itself (Meta verifies it), so no OTP and no typing a number — nobody can create a store for someone else's number.
- Only messages arriving on our number through the verified webhook are accepted.
- One store per phone via this flow; if the number already owns a store, the agent says so and sends a fresh login link instead of creating a duplicate.

## What gets created automatically (reuses today's store creation)
- Merchant account tied to the phone (login ID = phone number), merchant role, profile.
- Store with slug from brand name -> `brand.shopbanao.in`, default theme and fonts (Alegreya SC), store theme config.
- AI-written description, About Us, SEO title/description (existing store-content writer; static fallback if AI is slow — creation never stalls).
- Business type saved; category-based demo products when no old URL.
- Old store URL given -> existing URL-first migration runs in background (products kept as drafts, no demo products mixed in).
- Logo uploaded to the image CDN; if none, a clean text logo from the brand name.
- Telegram alert to you: "New AI store created: brand, phone, category".

## What the person receives on WhatsApp
- Store link: `https://brand.shopbanao.in`
- Admin link: one-tap auto-login link (expires in 24h), plus `shopbanao.in/login`
- Login ID: their phone number
- Temporary password (random, 10+ chars, never a shared "demo" password); they are asked to change it on first login.
Sent with a Meta-approved utility template (needs approval once before launch).

## Safety under heavy ad traffic
- Rate limits per phone, per IP, per token; tokens single-use for store creation.
- Creation is idempotent: double taps / refresh never create two stores.
- Brand name and uploads validated (bad words, reserved slugs like admin/www/api, logo size/type).
- Agent cannot do anything except collect these answers — no free-form actions, no access to other stores.
- Abandoned chats saved as leads (phone + answers) so you can follow up.

## Admin view
New "AI Onboarding" panel in the admin area: started / finished / dropped chats, stores created, where people stop, resend credentials button.

## Build phases
1. Signed link + landing page + AI chat (questions, slug check, logo upload).
2. Server store-creation function reusing current steps, idempotent, with progress.
3. WhatsApp credentials template + auto-login link + forced password change.
4. Lead capture, admin panel, Telegram alert, rate limits.
5. End-to-end test with a test number, then you write the marketing message.

## Technical details
- New page on main app: `/start` (not the ultra-minimal landing entry). Chat uses AI SDK streaming through an edge function with `openai/gpt-6-astra`, with structured tools: `check_slug`, `save_answer`, `confirm_and_create`. Agent state persisted in a new `onboarding_sessions` table (service-role only; GRANTs + RLS).
- Token: HMAC-signed `{phone, exp, nonce}` reusing the `wa-autologin-token` pattern; minting endpoint for the future campaign sender.
- New edge function `ai-onboard-create-store`: creates auth user `phone@...` via admin API (email_confirm true, no anonymous signup), inserts user_roles, then moves the current `CreateStore.tsx` client-side steps (stores insert, theme config, generate-store-content, store_pages, seed-demo-store / migration-start) into a shared server module so both paths stay identical. Idempotency key = session id; unique on phone.
- Password: crypto-random, stored only as auth hash; `must_change_password` flag in user metadata checked by dashboard.
- Auto-login: existing `wa-autologin` / `mintSessionForPhone` approach, merchant variant.
- WhatsApp send via existing platform sender + new utility template `store_ready_credentials`.
- Record architecture rule in AGENTS.md (server-side store creation shared module).

## Open decisions (defaults chosen unless you say otherwise)
- Send password on WhatsApp: yes (temporary, forced change) + one-tap login link.
- Language: English + Hindi (agent replies in the language the person writes in).
- Store goes live immediately with demo products, or stays "coming soon" until they add products: default live.
