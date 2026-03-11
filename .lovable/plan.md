

## Plan: Shiprocket-style Direct UPI Payment UI

### What the user wants
A checkout payment section that looks like the Shiprocket reference image — showing **Google Pay, PhonePe, Paytm** as individual tappable icons with logos (not text badges), plus an "Others" option. When a user taps e.g. "Google Pay", Razorpay opens pre-configured to that specific UPI app. The UI should feel native, not like a redirect to Razorpay.

### Current state
The checkout already has UPI/Cards/Net Banking/Wallets as separate selectable rows with radio-style buttons. The UPI option shows "GPay, PhonePe, Paytm" as small text badges.

### Changes — `src/pages/CheckoutPage.tsx`

**Redesign the payment method section (lines ~652-748) to match the reference:**

1. **"Pay via" header** with total amount shown (strikethrough original if coupon applied)

2. **UPI Section** — Replace the single UPI row with a grid of 4 icon buttons:
   - **Google Pay** — with a GPay-colored icon/logo (SVG inline or emoji placeholder)
   - **PhonePe** — with PhonePe purple icon
   - **Paytm** — with Paytm blue icon  
   - **Others** — generic UPI icon for other apps
   
   Each icon is a square card (~70x70px) with the app logo and name below. Tapping one sets `razorpayMethod = "upi"` and stores a `upiApp` state (e.g. `"google_pay"`, `"phonepe"`, `"paytm"`, `"other"`). The selected card gets a primary border highlight.

3. **Razorpay prefill config** — Update the Razorpay options to use `prefill.method = "upi"` and where possible set the UPI flow hint. Razorpay's standard checkout doesn't allow forcing a specific UPI app, but pre-selecting UPI method with the `config.display.blocks` ensures UPI opens first.

4. **COD row** — Keep as-is but rename to show partial COD style similar to reference (optional, keep simple for now).

5. **Cards / Net Banking / Wallets** — Keep as smaller secondary options below the UPI grid, or collapse into a "More payment options" expandable section.

6. **UPI app logos** — Use inline SVG icons for GPay (green/blue/yellow/red G), PhonePe (purple), Paytm (blue), and a generic UPI/India flag icon for "Others". No external image files needed.

### Visual layout (mobile 390px)
```text
┌─────────────────────────────┐
│ Pay via          ₹810.00    │
│                             │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ │ GPay │ │ PhPe │ │Paytm │ │Other │
│ │  🟢  │ │  🟣  │ │  🔵  │ │  🇮🇳  │
│ └──────┘ └──────┘ └──────┘ └──────┘
│                             │
│ ▸ More options (Card, Net..)│
│                             │
│ ○ Cash on Delivery          │
└─────────────────────────────┘
```

### Technical details
- Add `upiApp` state: `"google_pay" | "phonepe" | "paytm" | "other"`
- Selecting any UPI app sets `paymentMethod = "razorpay"` and `razorpayMethod = "upi"`
- Create inline SVG components for GPay, PhonePe, Paytm, UPI logos
- Move Cards/NetBanking/Wallets into a collapsible "More payment options" section
- No database or backend changes needed

