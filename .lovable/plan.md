

## Plan: Remaining CRO Items

### 1. Fix FinalCTA Consistency
**File: `src/components/landing/FinalCTA.tsx`**
Change "Create Your Online Store in 1 Minute" → "Create Your Online Store in 10 Minutes" to match Hero and FAQ claims. Add risk-reversal subtext: "7-day free trial • Zero commission • No card required".

### 2. Condense ProblemAwareness to 4 Items
**File: `src/components/landing/ProblemAwareness.tsx`**
Remove items 5 (repeat sale) and 6 (expensive website) — weakest impact. Keep the 4 strongest: Local reach, 24/7 sales, competitor threat, trust/credibility.

### 3. Add FAQ Schema Markup (JSON-LD)
**File: `src/components/landing/FAQ.tsx`**
Inject a `<script type="application/ld+json">` block with FAQPage structured data using the existing `faqs` array. This gives Google rich results for free.

### 4. Improve Mobile Navbar CTA
**File: `src/components/landing/Navbar.tsx`**
Add a compact "Start Free" CTA button visible on mobile in the top bar (next to hamburger), so users don't need to open the menu to find signup.

### 5. Landing Page WhatsApp Chat Widget
**File: `src/components/landing/LandingWhatsApp.tsx`** (New)
A floating WhatsApp button (bottom-right, above sticky CTA on mobile) linking to a pre-filled message like "Hi! I want to know more about ShopBanao". Hardcoded phone number for the ShopBanao support line.

**File: `src/pages/Index.tsx`** — Add `<LandingWhatsApp />`.

---

### Files Changed
| File | Action |
|------|--------|
| `src/components/landing/FinalCTA.tsx` | Edit |
| `src/components/landing/ProblemAwareness.tsx` | Edit |
| `src/components/landing/FAQ.tsx` | Edit |
| `src/components/landing/Navbar.tsx` | Edit |
| `src/components/landing/LandingWhatsApp.tsx` | Create |
| `src/pages/Index.tsx` | Edit |

