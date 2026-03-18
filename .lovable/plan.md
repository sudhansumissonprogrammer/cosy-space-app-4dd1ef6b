

## Plan: Improve Store Creation Flow

### Changes to `src/pages/CreateStore.tsx`

**1. Add "Both" order mode option**
- Change `orderMode` type from `"whatsapp" | "website"` to `"whatsapp" | "website" | "both"`
- Add a third radio card: "Both WhatsApp & Website" with a combined icon, so all 3 options are visible in a single-column layout on mobile

**2. Remove Theme step (Step 5)**
- Remove Step 5 from `STEPS` array (reduce to 4 steps)
- Remove the `THEMES` array and all theme selection UI
- Default `theme` to `"theme-1"` silently (no user choice needed)
- Update `goNext` max to 4, and the final step submit button triggers on step 4

**3. Default currency to INR**
- Change `useState("USD")` to `useState("INR")` for currency

**4. Make the flow more engaging and animated**
- Add smooth step transitions using CSS keyframe animations (slide-in from right on forward, slide-in from left on back)
- Add a progress bar (using the existing `Progress` component) below the step indicators showing percentage completion
- Add confetti/celebration animation on the final "Create Store" click (simple CSS-based)
- Add motivational micro-copy that changes per step ("Almost there!", "Looking great!", etc.)
- Add a floating "Skip optional fields" hint on steps 2, 3, 4 so users know they can proceed without filling everything
- Make the step indicator pills more visually engaging with a subtle scale animation on the active step

### Technical Details

- The `orderMode` state type union expands to include `"both"`
- The `STEPS` array shrinks from 5 to 4 items
- Navigation logic: `goNext` caps at step 4, submit button shows on step 4
- Add Tailwind keyframes for `slide-in-left` / `slide-in-right` transitions using the `direction` state already in place
- The `handleSubmit` function already uses the `theme` variable, which will just stay as `"theme-1"`

