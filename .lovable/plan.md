

## Plan: Major CRO Changes (Items 3, 4, 5, 8, 10)

Items 3 (hero rewrite) and 4 (sticky mobile CTA) are already implemented. This plan covers the remaining three:

---

### 1. Payment Partner Trust Strip Below Hero (Item 5)

**New component: `src/components/landing/PaymentTrustStrip.tsx`**

A slim horizontal bar placed directly after the Hero section showing payment partner logos (UPI, GPay, PhonePe, Paytm, Razorpay) with a label like "TRUSTED PAYMENT PARTNERS". Uses existing SVG/PNG assets from `public/icons/`. Bauhaus-style with border treatment, grayscale logos for subtlety.

**Update `src/pages/Index.tsx`**: Insert `<PaymentTrustStrip />` between `<Hero />` and `<CommissionCalculator />`.

---

### 2. Stronger Testimonials with Results & Specifics (Item 8)

**Update `src/components/landing/Testimonials.tsx`**:

- Add a bold metric callout to each testimonial (e.g., "Saved ₹15,000/month", "34 orders/week", "Setup in 15 min")
- Make quotes more specific with revenue numbers and timeframes
- Add star ratings (5 stars) for visual trust
- Revised testimonials:
  - Priya: "Saved ₹45,000 in 3 months" — commission savings story
  - Rahul: "34 orders/week" — growth story with WhatsApp integration
  - Anita: "₹15,000/month saved" — direct cost comparison story

---

### 3. Urgency & Scarcity in Pricing Section (Item 10)

**Update `src/components/landing/Pricing.tsx`**:

- Add a countdown-style urgency banner at the top: "🔥 Launch Offer — Lock in these prices before they increase"
- Add "Limited slots available" badge on the Growth plan
- Add an annual pricing toggle showing savings (e.g., "Save 20% with annual")
- Add a risk-reversal line under each CTA: "7-day free trial • Cancel anytime • No card required"

---

### Files Changed
| File | Action |
|------|--------|
| `src/components/landing/PaymentTrustStrip.tsx` | Create |
| `src/components/landing/Testimonials.tsx` | Edit |
| `src/components/landing/Pricing.tsx` | Edit |
| `src/pages/Index.tsx` | Edit (add PaymentTrustStrip) |

