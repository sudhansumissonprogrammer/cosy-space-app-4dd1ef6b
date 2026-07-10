
## Deep analysis — kya sahi hai, kya problem hai

### ✅ Jo already sahi hai (chhedna nahi)
- **Pixel + CAPI dedup**: same `event_id` browser aur server dono me jaata hai (`generateEventId` → passed to both `fbq(..., { eventID })` and `fireMetaCAPI({ eventId })`). Dedup 81% healthy hai.
- **Purchase server-side**: `place-order` request ke time `x-forwarded-for` / `cf-connecting-ip` se **real buyer IP** capture karke `orders.buyer_ip` me save hoti hai, aur `firePurchaseCapi.ts` line 207-208 use `client_ip_address` field me Meta ko bhejta hai. Purchase EMQ 7.6/10 isi wajah se sabse strong hai.
- **fbp** 99.69% — `ensureFbpCookie()` module-load pe chalta hai.
- **Phone hashing** 91-prefix ke saath sahi ho raha hai (line ~336).
- **External ID** 100% — `getOrCreateSfVid()` anon visitor ID stable hai.

### 🔴 Real root causes (yehi EMQ ~6.2 khaa rahe hain)

**1. `setCapiUser` bahut late chalta hai (biggest EMQ killer)**
- `CheckoutV2Page.tsx` step-2 (address) me hi Advanced Matching set hoti hai — line 297-320.
- Lekin `CheckoutPhoneStep.tsx` (step-1) me phone type/verify hote hi `setCapiUser` **nahi** chalta.
- Nateeja: `InitiateCheckout` (6.4) aur `AddPaymentInfo` events phone-only ke saath fire ho sakte the, but user_data khali jaata hai.
- Isi wajah se PageView/ViewContent/AddToCart pe email/name/city sab 3-5% dikhte hain — sirf address step tak pahunche users hi contribute karte hain.

**2. Phone number storefront login/customer se pehle populate nahi hota**
- `storefront_customers` table me phone/email already hai (returning shoppers). Storefront me login hone pe hi `setCapiUser` fire hota hai — but bahut jagah dhang se hydrate nahi hota. Result: har PageView pe registry khali.

**3. fbc coverage 68.52% — 31% ad clicks pe missing**
- `ensureFbcPersisted()` sirf `?fbclid=` query param se cookie banata hai.
- Missing: (a) Facebook in-app browser sometimes strips `fbclid` but sends `_fbc` via referrer meta — hum handle nahi karte. (b) Cross-page navigation me agar cookie expire / block ho, koi fallback nahi. (c) sessionStorage backup nahi rakhte.

**4. Browser-events me client IP forward NAHI hoti (deliberate)**
- `meta-capi/index.ts` ZERO-BAN POLICY (line ~316): `client_ip_address` **intentionally drop** kiya. Comment kehta hai: routing badalne se Supabase/AWS datacenter IP leak ho jaayegi = ad-account ban.
- **Meta ka warning yahin se aa raha hai** ("Forward client IP"). Tumhari intuition sahi hai — safely forward karna hai, but **sirf tab jab hume 100% pata ho ki IP asli visitor ka hai**, server ka nahi.
- Safe fix: browser se `fetch("https://api.ipify.org?format=json")` se client apna public IP khud le, phir edge fn ko explicitly bheje. Edge fn `x-forwarded-for` / `cf-connecting-ip` **cross-validate** kare — dono match hone pe hi Meta ko forward kare. Mismatch pe drop (server IP leak prevented).

**5. Currency + value default hone se pichle time invalid warnings aati thi** — already fixed (v8.69.0). No action.

**6. Event freshness (hourly)** — Meta Events Manager UI ka display lag hai, hum real-time me hi fire karte hain. Ek hafte me apne-aap "Real Time" ho jaayega jab consistent volume aa jaaye. No code change.

---

## Fix plan (priority order)

### P0 — Fire `setCapiUser` on phone-step submit
**File**: `src/components/storefront/CheckoutPhoneStep.tsx`
- Jaise hi Step-1 me `canon` (valid 10-digit phone) confirm ho (line ~143 ke aas paas `localStorage.setItem("checkout_phone", canon)` ke saath hi), call:
  ```ts
  import { setCapiUser } from "@/lib/metaEnrichment";
  setCapiUser({ phone: canon, externalId: customer?.id });
  ```
- Isse `InitiateCheckout` + `AddPaymentInfo` phone + external_id ke saath jaayenge → EMQ ~6.4 → ~8+.

### P0 — Hydrate registry from existing storefront customer on shell mount
**File**: `src/layouts/StorefrontShell.tsx` (aur/ya `StorefrontAuthContext.tsx`)
- Jab storefront customer session load ho (email/phone/name mil jaaye), turant `setCapiUser({...})` call kare. Abhi ye kuch themes me hai, kuch me nahi — centralize karo StorefrontAuthContext me: jab `customer` object set ho, waha hi `setCapiUser` call kare. Iske baad har PageView/ViewContent registry se enrich hoga.

### P0 — Safe client-IP forwarding for browser CAPI
**Files**: `src/lib/metaCapi.ts`, `supabase/functions/meta-capi/index.ts`
1. Client-side: pehli baar storefront load hote hi async fetch `https://api.ipify.org?format=json` (cache in sessionStorage as `__sf_client_ip__`, TTL 1hr). Pass in fireMetaCAPI body as `declared_client_ip`.
2. Edge fn: read `req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]`. **Only if `declared_client_ip === headerIp`**, set `userData.client_ip_address = headerIp`. Otherwise drop silently.
3. Additional guard: reject IPs in private ranges (10.x, 172.16-31.x, 192.168.x, 127.x, ::1) and Supabase/AWS ranges (list se). `isPrivateIp` helper `firePurchaseCapi.ts` me already hai — reuse.
- Result: real client IP jaayega, mismatch (proxy/CDN edge slip) pe kuch nahi jaayega. Zero-ban policy intact, Meta warning gone, ~14.77% conversion lift capture.

### P1 — Widen fbc capture
**File**: `src/lib/metaEnrichment.ts`
- `ensureFbcPersisted()` me: agar cookie already hai but `?fbclid=` bhi URL me hai aur naya hai, cookie ko refresh karo (latest click wins per Meta spec).
- sessionStorage backup: cookie set ke saath `sessionStorage.setItem("__sf_fbc__", fbc)`. `getMetaCookies()` me cookie khali ho to sessionStorage se fallback lo.
- iOS ITP + FB in-app WebView cookie loss se protect karega → fbc 68% → 90%+.

### P1 — Optional Advanced Matching from lightweight PDP prompt (LATER — user tap needed)
- Skip abhi ke liye — user ne bola tha "invent mat karo".

---

## Files touched (summary)
1. `src/components/storefront/CheckoutPhoneStep.tsx` — call `setCapiUser` on phone confirm.
2. `src/contexts/StorefrontAuthContext.tsx` — hydrate `setCapiUser` from `customer` on session load/change.
3. `src/lib/metaEnrichment.ts` — fbc sessionStorage backup + refresh-on-new-fbclid.
4. `src/lib/metaCapi.ts` — fetch + cache client IP, pass `declared_client_ip` in body.
5. `supabase/functions/meta-capi/index.ts` — validate declared_client_ip === header IP, then attach `client_ip_address`; reuse `isPrivateIp` guard.

## Expected EMQ delta
| Event | Now | After |
|---|---|---|
| PageView | 6.2 | 8.0–8.5 (external_id already 100%, +IP +customer registry) |
| ViewContent | 6.1 | 8.0 |
| AddToCart | 6.3 | 8.0 |
| InitiateCheckout | 6.4 | 8.5–9.0 (phone from step-1) |
| Purchase | 7.6 | 8.5+ (IP already sent, better name/email match) |
| fbc coverage | 68.5% | 90%+ |

## Risk
- IP forwarding: cross-validation approach means zero datacenter-IP leak. Worst case: IP simply not sent (same as today).
- setCapiUser on phone step: only fires when user explicitly typed phone — no invented data.
- Backward compatible: no schema changes, no breaking API contracts.
