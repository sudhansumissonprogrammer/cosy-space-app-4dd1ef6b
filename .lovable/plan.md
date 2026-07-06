## Speed up marketing → PDP path (no template resubmit)

Three coordinated changes. All keep the URL `shopbanao.in/r/<token>` — WhatsApp templates untouched.

---

### 1. PDP bundle lazy-splits (frontend, ~30 min)

In `src/pages/ProductDetail.tsx` (and V19/V20/V22 variants), convert three eager imports to lazy so they don't block first paint:

- `VideoSlide` → `lazy(() => import(...))`, only mount when `product.video_url` exists
- `Dialog` chain (zoom modal, share modal) → dynamic `import()` on first open
- `UniversalProductCard` → remove from PDP top import; it's already reachable via lazy `RelatedProducts`

Cuts ~40–80KB gzipped off the critical PDP chunk. Faster hydrate on every mobile.

---

### 2. Move `/r/*` redirect into the Cloudflare Worker (biggest single win)

Since `shopbanao.in` is on Cloudflare, add a Worker Route `shopbanao.in/r/*` so redirects run at the edge with **no Deno hop, no cold start**.

Update `docs/cloudflare-worker-current.js`:

- Detect hostname `shopbanao.in` + path `/r/<token>` at the top of the worker's `fetch()`
- Parse token prefix (`o-` / `t-` / `c-` / `p-`) same as current `wa-r`
- Look up order/product/cart via Supabase REST (`https://<ref>.supabase.co/rest/v1/...`) using service role key stored as Worker secret `SUPABASE_SERVICE_KEY`
- Cache the lookup in Worker KV (`STORE_KV`) keyed by token — same TTLs as today (product 5 min, order 1 day, cart no-cache)
- Emit the same 301/302 with `Link: rel=preconnect` + `rel=preload as=image` (hero) + `rel=preload as=fetch` (PDP API) headers
- **Emit HTTP 103 Early Hints** with the Link headers before the 302 body (Deno can't do this; Cloudflare can) — browser starts hero download ~200ms earlier
- Fire-and-forget click log to `wa_link_clicks` via Supabase REST (no `await`)

Keep the existing `supabase/functions/wa-r/index.ts` deployed as a **fallback** in case the worker route is bypassed (nothing to remove; harmless).

**Manual step for user:** In Cloudflare dashboard → Workers → Routes, add `shopbanao.in/r/*` → your existing worker. (Worker file itself deploys via your normal process.)

Expected: `/r/*` latency drops from ~700ms → ~40–80ms. Plus 103 Early Hints shave another ~150–250ms off LCP.

---

### 3. Auto-prewarm PDP cache on product save (~20 min)

Ensure every WhatsApp campaign click lands on a hot cache — never a cold DB hit.

In the product create/edit code path (client-side after save success), call the existing `prewarm-store` edge function with the store slug + custom domain. It already warms `/api/prewarm?slug=...` — extend the worker's prewarm handler to also warm `/api/pdp?slug=<newly-saved-slug>` when a `productSlug` param is passed. Fire-and-forget, no UX impact.

Result: merchant saves product → 300ms later, edge KV holds the PDP JSON → first WhatsApp click is warm-path (~200ms end-to-end lookup).

---

## Technical details

**Worker `/r/*` handler sketch (added early in `fetch()`):**
```js
if (host === "shopbanao.in" && url.pathname.startsWith("/r/")) {
  return handleWaRedirect(request, url, env, ctx);
}
```

**Supabase REST lookup pattern:**
```js
const r = await fetch(
  `https://${env.SUPABASE_REF}.supabase.co/rest/v1/products?id=eq.${id}&select=id,slug,stores(slug,custom_domain)`,
  { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
);
```

**Early Hints (Cloudflare-native):**
```js
return new Response(null, {
  status: 302,
  headers: { Location: target, Link: linkHeaders, "Cache-Control": "..." }
  // CF automatically converts Link headers to 103 Early Hints when enabled on the zone
});
```
User must enable **Early Hints** in Cloudflare zone → Speed → Optimization (one toggle).

**Secrets needed as Cloudflare Worker environment vars:**
- `SUPABASE_REF` = `dqepeywgftbpxeeqfuwt`
- `SUPABASE_SERVICE_KEY` = (from Lovable Cloud — user pastes into CF Workers dashboard)

---

## Expected combined result

| Stage | Now | After |
|---|---|---|
| `/r/*` redirect | 700ms | 60ms |
| Early Hints preload | — | −200ms LCP |
| PDP hydrate | 1.5–2.5s | 1.0–1.7s |
| Cold cache DB hit | Sometimes | Never |
| **Total to LCP** | **~4.5s** | **~2.0–2.5s** |

No template resubmit. No storefront breaking change. Reversible per-item.

---

## Deploy order

1. Ship PDP lazy-splits (frontend, auto-deploys)
2. Ship worker changes to `docs/cloudflare-worker-current.js` — you deploy manually as usual
3. Add worker route `shopbanao.in/r/*` in Cloudflare dashboard
4. Add `SUPABASE_REF` + `SUPABASE_SERVICE_KEY` as Worker env vars in Cloudflare
5. Enable Early Hints toggle in Cloudflare Speed panel
6. Extend `prewarm-store` + client save hook (frontend, auto-deploys)