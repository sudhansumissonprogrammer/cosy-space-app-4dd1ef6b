# Roadmap

## Done
- Store Assistant (dashboard AI help): DB tables, 54-article knowledge base, `dashboard-assistant` edge fn (live model pick, Hinglish retrieval, dashboard map), assistant panel + hook, header/⌘K entry points
- Payment resume fix: per-status bounce in `usePaymentResumeGuard` so a paid order always reaches the confirmation screen

## Open
- [ ] Authenticated end-to-end test of the assistant panel (needs a signed-in preview session)
- [ ] Deploy updated `docs/cloudflare-worker-current.js` (domain resolver DB fallback) to Cloudflare
- [ ] Make Store Assistant answers shorter, more direct, and intelligent (no big paragraphs)
