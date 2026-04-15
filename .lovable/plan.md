

# Transform Landing Page: SaaS Product → Service Business

The entire landing page currently reads as "create your own store" (DIY SaaS). You want it repositioned as a **service** — "we build your ecommerce website for ₹10,000". Here's every file that needs changes:

---

## Files to Modify

### 1. Hero (`Hero.tsx`) — already mostly done
- Change subtitle to emphasize "we build it for you"
- Change CTA buttons: "Start Free Trial" → "Get Started" / "Talk to Us"
- Update trust badges: remove "Zero Commission", add "Done For You", "Ready in 48 Hours"
- Remove "7-Day Free Trial" badge, replace with "Professional Service"

### 2. Navbar (`Navbar.tsx`)
- "Start Free" button → "Get Quote" or "Contact Us"
- "Store Owner Login" → "Client Login"
- Remove "Pricing" and "For Sellers" nav links, add "Our Work" / "Process" / "Contact"

### 3. ProblemAwareness (`ProblemAwareness.tsx`)
- Keep the problems (they still apply), but change solutions to service-oriented language
- e.g. "We'll build you a professional online store" instead of "Go online and sell"

### 4. CommissionCalculator (`CommissionCalculator.tsx`)
- Reframe as "How much revenue are you missing without an online store?"
- Change CTA from "Stop Losing Money — Start Free" → "Get Your Store Built — ₹10,000"

### 5. WhoUses (`WhoUses.tsx`)
- Change heading from "Built For Businesses Like Yours" (fine) but update descriptions to service tone
- e.g. "We build custom stores for clothing brands with size variants" instead of "Sell ethnic wear..."

### 6. SolutionFlow (`SolutionFlow.tsx`)
- Complete rewrite of 4 steps to service flow:
  1. "Tell Us Your Needs" — Share your business details
  2. "We Design & Build" — Custom store built by our team
  3. "Review & Launch" — You approve, we go live
  4. "Start Selling" — Your store is live, orders flow in
- Change CTA: "Create Your Store in 10 Minutes" → "Get Your Store Built — ₹10,000"

### 7. StoreLookShowcase (`StoreLookShowcase.tsx`)
- Change heading: "How Your Store Actually Looks" → "Stores We've Built"
- Change subtitle to "Real stores built by our team for real businesses"

### 8. Testimonials (`Testimonials.tsx`)
- Update quotes to sound like service clients (not self-service users)
- e.g. "The ShopBanao team built my store in 2 days" instead of "Setup took 15 minutes flat"

### 9. FAQ (`FAQ.tsx`)
- Rewrite all Q&As for service model:
  - "How does the process work?" / "How long does it take?" / "What's included in ₹10,000?" / "Do I need technical knowledge to manage it?" / "What payment methods will my store support?" / "Can I get a custom domain?" / "What if I need changes later?" / "Do you provide ongoing support?"

### 10. FinalCTA (`FinalCTA.tsx`)
- "Create Your Online Store in 10 Minutes" → "Get Your Online Store Built for ₹10,000"
- CTAs: "Start Free Trial" → "Get Started Now", remove "View Themes"
- Update subtext to service language

### 11. StatsBar (`StatsBar.tsx`)
- "Stores Created" → "Stores Delivered"
- Keep revenue and products stats

### 12. Footer (`Footer.tsx`)
- "Build your online store with zero commission" → "Professional ecommerce websites built for Indian businesses"
- "Product" section → "Services"
- Fix duplicate copyright text bug

### 13. ExitIntentPopup (`ExitIntentPopup.tsx`)
- Remove "free trial" / "live in 10 minutes" language
- Change to "Get your store built for just ₹10,000 — talk to us today"
- CTA: "Start Free Trial" → "Get Started" or link to WhatsApp

### 14. StickyMobileCTA (`StickyMobileCTA.tsx`)
- "Start Free Trial" → "Get Your Store — ₹10,000"

### 15. LiveStorePreview (`LiveStorePreview.tsx`)
- "See What Sellers Are Building" → "Stores We've Delivered"
- "Create Your Store Free" → "Get Yours Built"

### 16. LandingJsonLd (`LandingJsonLd.tsx`)
- Update structured data descriptions to service model

### 17. PaymentTrustStrip (`PaymentTrustStrip.tsx`)
- Keep as-is (payment partners still relevant)

---

## Key Messaging Shift

| Before (SaaS/DIY) | After (Service) |
|---|---|
| Create your store | We build your store |
| Start Free Trial | Get Started / Contact Us |
| No coding needed | Done for you |
| In 10 minutes | Ready in 48 hours |
| Zero commission | One-time ₹10,000 |
| Sign up | Get in touch |

---

## Technical Notes
- All changes are text/copy only — no structural or layout changes needed
- All CTAs pointing to `/signup` will be changed to WhatsApp link (`https://wa.me/919692282485`) or a contact form
- The Bauhaus design system and component structure remain untouched

