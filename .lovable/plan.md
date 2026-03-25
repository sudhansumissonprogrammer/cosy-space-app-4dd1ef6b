

## Update Cloudflare Worker: Clean Domain Strategy

### Summary
The current worker (`docs/cloudflare-worker-current.js`) already implements ~90% of the requirements. Two changes are needed:

### What's Already Working
- Subdomain → custom domain 301 redirect (line 781-793) ✓
- Custom domain resolution + serving (line 822-831) ✓
- www → apex redirect for custom domains (line 804-809) ✓
- 404 for unknown domains (line 835-849) ✓
- Parallel lookups with `Promise.all` (line 781) ✓

### Changes Required

**1. Update credentials (lines 17-23)**
Replace old Supabase URL/key and origin host with current project values:
- `ORIGIN_HOST` → `core-gleam-hub.lovable.app`
- `SUPABASE_URL` → `https://vjjlxmqgqtquggdajjvi.supabase.co`
- `SUPABASE_ANON_KEY` → current anon key

**2. Fix root domain `/store/:slug` redirect (lines 748-759)**
Currently, `storivo.in/store/mystore` always redirects to `mystore.storivo.in`. It should first check if a custom domain exists and redirect there instead.

Current:
```
if (storeMatch) {
  return redirect → slug.storivo.in
}
```

Updated logic:
```
if (storeMatch) {
  const customDomain = await getCustomDomainForSlug(slug);
  if (customDomain) → redirect to https://customDomain/path
  else → redirect to https://slug.storivo.in/path
}
```

**3. Update all three worker doc files**
Apply the same credential + routing fix to:
- `docs/cloudflare-worker-current.js` (primary/production)
- `docs/cloudflare-worker-production.js` (reference)
- `docs/cloudflare-worker-unified.js` (reference)

### Behavior After Changes

| Scenario | Result |
|---|---|
| `mystore.storivo.in` (no custom domain) | Serves store |
| `mystore.storivo.in` (has `mybrand.com`) | 301 → `https://mybrand.com` |
| `mybrand.com` | Serves store |
| `www.mybrand.com` | 301 → `https://mybrand.com` |
| `storivo.in/store/mystore` (no custom domain) | 301 → `https://mystore.storivo.in` |
| `storivo.in/store/mystore` (has `mybrand.com`) | 301 → `https://mybrand.com` |
| `unknown.com` | 404 |

No infinite redirect loops possible — custom domain path never checks for another redirect.

