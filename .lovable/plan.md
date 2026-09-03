# Store Assistant — in-dashboard AI help for every merchant

An always-available AI helper inside the merchant dashboard that answers "how do I add a payment gateway?", "where do I set shipping charges?", "why is my order pending?" — with step-by-step guidance, direct links to the exact page, and awareness of what *this* store has already configured.

## What the merchant sees

- A **Help** button in the dashboard header (and `?` / `⌘K → Ask AI`), opening a right-side chat panel that stays available on every dashboard page.
- Answers are short, numbered steps, each step linking straight to the page ("Open Payments →"), so the merchant can click and act.
- The assistant knows the merchant's current state: if Razorpay keys are missing it says so and links to the field; if no products exist it starts from "Add your first product".
- Suggested starter questions based on the page they are on (on Orders: "How do I add tracking?"; on Settings: "How do I connect my domain?").
- If the assistant cannot answer confidently it hands off: "Message support on WhatsApp" with the conversation attached.

## How it is "trained" (no model fine-tuning)

Fine-tuning is the wrong tool here — the dashboard changes weekly. Instead the assistant is grounded on three live sources, assembled per question:

1. **Navigation map** — `src/config/dashboardNav.ts` already carries `id`, `path`, `description`, `keywords` for every menu item. It becomes machine-readable ground truth for "where do I do X".
2. **Help knowledge base** — a new `src/content/help/` folder of short markdown articles, one per task (add product, connect Razorpay/Cashfree/PayU/UPI, enable COD, partial payment, shipping rates, Delhivery/Blue Dart/Ekart, coupons, abandoned cart recovery, WhatsApp, custom domain, theme, SEO, wallet & 2% commission, returns, refunds, analytics). Each article has front-matter: `id`, `title`, `route`, `keywords`, `steps`, `related`. Authored from the actual dashboard code so it never invents fields.
3. **Live store context** — a read-only snapshot of the current store: which payment providers are configured, shipping/tax setup done or not, product/order counts, billing mode, domain status, WhatsApp connection. Never secrets — only booleans and counts.

Retrieval is keyword + embedding search over (1) and (2), then the top ~8 chunks plus (3) go into the prompt. This keeps answers correct as the dashboard evolves: change a route or add a menu item and the assistant is updated by the same edit.

## Technical design

**Data (Lovable Cloud)**
- `help_articles` — id, slug, title, route, body, keywords[], embedding (vector), updated_at. Public read; writes admin-only.
- `assistant_conversations` — id, store_id, user_id, title, created_at.
- `assistant_messages` — id, conversation_id, role, content, sources jsonb, created_at.
- `assistant_feedback` — message_id, helpful bool, note. Feeds an admin view of unanswered questions.
- RLS: conversations/messages scoped to `store_id` owned by `auth.uid()` (plus admin `has_role`). GRANTs for `authenticated` + `service_role` in the same migration.

**Edge functions**
- `help-index` (admin/cron) — reads `src/content/help/*.md` shipped as a JSON bundle, upserts `help_articles`, generates embeddings via the Lovable AI Gateway embeddings endpoint.
- `dashboard-assistant` — the chat endpoint. Validates the JWT, confirms the caller owns `store_id`, rate-limits per user (`edge_rate_limits`), retrieves context, streams the answer from the Lovable AI Gateway.
  - Model: `google/gemini-3.7-flash` (fast, cheap, high volume) with `service_tier: "priority"`.
  - Tools the model can call: `get_store_status` (config booleans/counts), `find_page` (nav lookup by intent), `get_recent_orders_summary` (counts only, no PII).
  - System prompt: answer only from provided context; always cite the page route; never invent settings; never reveal keys; reply in the merchant's language (Hindi/Hinglish supported); if unsure, say so and offer support handoff.
  - Errors follow gateway semantics: 429/5xx retry with backoff, 402/403 surface a clear message and stop.

**Frontend**
- `src/components/dashboard/assistant/AssistantPanel.tsx` — chat UI (streamed, markdown, step links), lazy-loaded so it costs nothing until opened.
- `src/hooks/useStoreAssistant.ts` — conversation state, streaming, persistence.
- `src/lib/assistantContext.ts` — builds the page-aware context (current route, store snapshot from existing dashboard queries; no new requests).
- Entry points: header Help button, `⌘K` palette row "Ask the assistant", contextual "Need help?" links on Payments, Shipping, Domain and Wallet pages.
- Links inside answers use the router, so the merchant lands on the exact anchor (e.g. `/dashboard/stores/:slug/settings#domain`).

**Guardrails**
- Read-only. The assistant never changes settings or places orders; it explains and links.
- Store snapshot never includes API keys, tokens, customer PII or the service-role key.
- Per-user rate limit + per-store daily cap; both surfaced politely in the UI.

## Build order

1. Migration: 4 tables + RLS + GRANTs, `pgvector` for embeddings.
2. `src/content/help/` — first 25 articles covering payments, shipping, catalog, orders, marketing, domain/SEO, wallet/billing.
3. `help-index` edge function + admin "Reindex help" button.
4. `dashboard-assistant` edge function with retrieval, tools, streaming; test with real requests.
5. Assistant panel UI + header/⌘K entry points, page-aware starter questions.
6. Contextual help links on the highest-friction pages; feedback thumbs.
7. Admin view: top questions, unanswered/negative-feedback list → drives new articles.

## Notes

- Article coverage is what determines quality; the plan front-loads the 25 highest-traffic tasks and then grows from real unanswered questions.
- Because the knowledge base lives in the repo next to the code, any future dashboard change should update its article in the same edit — that is the process that keeps the assistant accurate.
