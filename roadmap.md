# Roadmap

## Done
- Store Assistant (dashboard AI help): DB tables, 54-article knowledge base, `dashboard-assistant` edge fn (live model pick, Hinglish retrieval, dashboard map), assistant panel + hook, header/⌘K entry points
- Payment resume fix: per-status bounce in `usePaymentResumeGuard` so a paid order always reaches the confirmation screen
- Shipped cancellation safety: paid shipped/tracked orders can be manually cancelled with commission reversal; new tracking always starts as shipped

## Open
- [ ] Authenticated end-to-end test of the assistant panel + new analytics tools (needs a signed-in preview session)
- [ ] Deploy updated `docs/cloudflare-worker-current.js` (domain resolver DB fallback) to Cloudflare
- [x] Deploy Worker mic-permission fix — live now: permissions-policy `microphone=(self)` confirmed on utkalwatch.in, getUserMedia OK
- [x] Store Assistant: short direct answers + per-store business insights (30d orders/revenue/catalog/carts → findings + ranked actions)
