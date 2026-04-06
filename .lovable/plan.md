

## Plan: Complete CRO Funnel Optimization

The current landing page has strong individual sections but several gaps prevent it from functioning as a high-conversion funnel. Here is what needs fixing:

### Issues Found
1. **ProblemAwareness is still in Hinglish** — problem/solution text was never rewritten to English
2. **No social proof numbers bar** — missing a "500+ stores, ₹2Cr+ processed" strip that builds instant credibility
3. **No mid-funnel CTAs** — after ComparisonTable (a high-intent section), there is no CTA before Pricing
4. **No exit intent popup** — users leaving get no last-chance offer
5. **WhatsApp widget uses placeholder phone** — should use real number (919692282485, already in Footer)
6. **Outdated copy** — Footer says "© 2024", ComparisonTable says "as of 2024"
7. **Section order is suboptimal** — ProblemAwareness (agitation) should come before CommissionCalculator (quantified pain), not after

---

### 1. Rewrite ProblemAwareness to English
**File: `src/components/landing/ProblemAwareness.tsx`**
Replace all Hinglish problem/solution strings with professional English copy. Same 4 items, same structure.

### 2. Add Social Proof Stats Bar
**File: `src/components/landing/StatsBar.tsx`** (already exists — check and update)
Add a slim bar with 3-4 animated counter stats: "500+ Stores Created", "₹2Cr+ Revenue Processed", "10,000+ Products Listed", "4.8/5 Seller Rating". Place it after PaymentTrustStrip in Index.tsx.

### 3. Reorder Sections for Better Funnel Psychology
**File: `src/pages/Index.tsx`**
New order:
```
Hero → PaymentTrustStrip → StatsBar → ProblemAwareness → CommissionCalculator → WhoUses → SolutionFlow → StoreLookShowcase → Testimonials → ComparisonTable → Pricing → FAQ → FinalCTA → Footer
```
Key change: Problem agitation before calculator, showcase before testimonials, comparison right before pricing.

### 4. Add Exit Intent Popup
**File: `src/components/landing/ExitIntentPopup.tsx`** (New)
Detects mouse leaving viewport (desktop) or back-button intent. Shows a modal: "Wait! Get 20% off your first month" with email capture or direct signup CTA. Shows only once per session (sessionStorage flag).

### 5. Add Mid-Funnel CTA After ComparisonTable
**File: `src/components/landing/ComparisonTable.tsx`**
Add a CTA block at the bottom: "Ready to switch? Start your free trial" with the standard red button.

### 6. Fix WhatsApp Phone & Outdated Copy
**File: `src/components/landing/LandingWhatsApp.tsx`** — Change phone from `919876543210` to `919692282485`
**File: `src/components/landing/Footer.tsx`** — Update "© 2024" to "© 2025"
**File: `src/components/landing/ComparisonTable.tsx`** — Update "as of 2024" to "as of 2025"

---

### Files Changed
| File | Action |
|------|--------|
| `src/components/landing/ProblemAwareness.tsx` | Edit — English copy |
| `src/components/landing/StatsBar.tsx` | Edit or Create — social proof numbers |
| `src/pages/Index.tsx` | Edit — reorder sections, add StatsBar & ExitIntentPopup |
| `src/components/landing/ExitIntentPopup.tsx` | Create — exit intent modal |
| `src/components/landing/ComparisonTable.tsx` | Edit — add CTA, fix year |
| `src/components/landing/LandingWhatsApp.tsx` | Edit — fix phone number |
| `src/components/landing/Footer.tsx` | Edit — fix year |

