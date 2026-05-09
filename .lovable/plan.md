## Goal

Refresh the Partner area UI to feel as polished and modern as the Store Dashboard: bold hero numbers, animated counts, premium gradient cards, horizontally-scrollable stat strips on mobile, tighter spacing, and a sticky bottom tab bar on phones.

Scope: visual/UI only — no business logic, data, or backend changes.

## Pages to redesign

1. **`src/layouts/PartnerLayout.tsx`** — header + tab nav
2. **`src/pages/partner/PartnerOverview.tsx`** — overview/home tab
3. **`src/pages/partner/PartnerWallet.tsx`** — wallet tab
4. **`src/pages/partner/PartnerWithdrawals.tsx`** — withdrawals tab
5. **`src/pages/partner/PartnerLanding.tsx`** — public landing (premium polish pass)
6. **`src/pages/partner/PartnerLogin.tsx` & `PartnerSignup.tsx`** — light polish only (cards, spacing, gradient header)

## Design direction (matches Dashboard.tsx)

- **Hero block at the top** of each tab — gradient `from-primary to-primary/70`, big tabular-nums number, secondary CTA on the right.
- **Animated stat count-up** via existing `useCountUp` hook (already used in Dashboard).
- **Stat strip**: horizontal scroll on mobile (`flex gap-2.5 overflow-x-auto scrollbar-hide`), grid on `md+`, compact icon+label+value cards (mirrors Dashboard `statCards`).
- **Premium cards**: `rounded-2xl`, soft border, no harsh shadow, subtle `bg-accent/20` strips for inline info (matches store URL strip).
- **Section headings**: `text-sm font-bold tracking-tight` with optional small action button on the right (View all / Refresh).
- **Empty states**: centered icon-in-circle + helper text + small CTA button (same pattern as Dashboard's empty charts).
- **Status pills**: keep existing tone map but switch to `rounded-full px-2.5 py-0.5 text-[11px] font-semibold` and use semantic tokens (no raw `amber-100` etc.; map to `bg-warning/15 text-warning` style via Tailwind arbitrary or keep current colors but unify).

## Mobile-friendly improvements

- **Sticky bottom tab bar** on phones (replaces top nav scroll-row on small screens). Top nav stays for `md+`. Pattern: fixed bottom strip with 3 icon+label items, active state uses `bg-primary/10 text-primary`. Hidden ≥ md.
- **Larger touch targets** (44px min) on all action buttons.
- **Safe-area padding** (`pb-[env(safe-area-inset-bottom)]`) on bottom bar.
- **Pull-to-refresh hook** on Overview/Wallet using existing `usePullToRefresh` (same as store dashboard).

## Per-page changes

### PartnerLayout
- Header: keep partner code/name on the left, add subtle avatar circle with initial. Notifications bell + sign-out on the right.
- Replace the top scroll-row tab nav with: full nav on `md+` only, sticky bottom tab bar on mobile.
- Add `<main className="pb-20 md:pb-6">` so content doesn't hide behind bottom bar.

### PartnerOverview
- New **gradient hero** showing "Total earned" big + small "this month" delta beneath, copy/share CTAs as outline-on-gradient buttons.
- Stat strip: Clicks · Signups · Paid · Conversion% (compute % client-side from signups/clicks). Animated count-up.
- Referral link card → premium card: QR larger on `md+`, three quick share chips (WhatsApp, Copy link, Copy code) with icons.
- Recent referrals + commission history → split cards with section headers and "Empty state" illustrations.

### PartnerWallet
- Hero withdrawable card stays, but enlarged with mini-progress bar showing `pending → approved` flow.
- 4 tile strip → horizontal scroll on mobile (matches Dashboard pattern).
- Wallet activity → unify row layout with subtle hover, credit/debit chip, date in muted micro-text.

### PartnerWithdrawals
- Form card → cleaner: amount with quick-fill chips (`25%`, `50%`, `Max`), method tabs styled to match `SettingsTabsNav` look.
- History rows → card list with status pill at top-right, method icon (UPI/Bank), and collapsible admin notes.

### PartnerLanding (premium polish)
- Add subtle hero gradient backdrop and soft "noise" overlay; bigger headline weight; sticky CTA on mobile.
- Convert benefits cards to use the same icon-tile style as `FeaturesGrid` on the marketing site for brand consistency.

### PartnerLogin / PartnerSignup
- Wrap in a centered premium card on a soft gradient background; keep form logic untouched.

## Technical notes

- All colors via semantic HSL tokens (`primary`, `muted`, `accent`, `border`, `foreground`). No raw hex.
- Reuse: `useCountUp`, `usePullToRefresh`, `Card`, `Button`, `Tabs`, existing `NotificationsBell`.
- New small component: `src/components/partner/PartnerBottomNav.tsx` (mobile bottom tab bar).
- New small component: `src/components/partner/StatTile.tsx` (shared tile used across overview/wallet).
- No DB/edge function changes. No new dependencies.

## Out of scope

- Data model, edge functions, route changes, auth flow, copy rewrites beyond what fits new layout.
