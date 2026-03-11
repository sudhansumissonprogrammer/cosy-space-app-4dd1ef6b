

## Add 7 New Color Combinations (2 from Reference + 5 Custom)

### What We're Building
7 new color combos added to the existing 8, totaling 15 palettes. Two are inspired directly by the uploaded reference images; five are custom high-impact designer palettes including 2 gradient-forward trending designs.

### New Palettes

**From Reference Images:**

| # | Name | Primary | Accent | Background | Text | Marquee | Inspiration |
|---|------|---------|--------|------------|------|---------|-------------|
| 1 | **Neon Demonic** | #e6ff2a (electric yellow-green) | #0c4651 (deep teal) | #0c4651 | #e6ff2a | neon yellow-to-teal | Image 1: Demonic #e6ff2a + Atomic #0c4651 |
| 2 | **Blaze Orange** | #ff4103 (vivid orange) | #001621 (near-black) | #001621 | #f0ece6 | orange-to-dark | Image 2: Orange #ff4103 + Darkin #001621 |

**Custom Designer Palettes (5):**

| # | Name | Primary | Accent | Background | Text | Marquee | Vibe |
|---|------|---------|--------|------------|------|---------|------|
| 3 | **Coral Sunset** | #FF6B6B (warm coral) | #2D1B69 (deep indigo) | #FFF5F5 | #1a1a1a | coral-peach-rose | Warm, inviting, modern |
| 4 | **Electric Violet** | #8B5CF6 (vivid purple) | #1E1B4B (midnight) | #F5F3FF | #1a1a1a | violet-lavender-purple | Bold tech-forward |
| 5 | **Aurora Gradient** | #06B6D4 (cyan) | #7C3AED (violet) | #0F172A (dark slate) | #F1F5F9 | cyan-teal-violet gradient | Dark mode, gradient-forward trending |
| 6 | **Sunset Fusion** | #F97316 (orange) | #EC4899 (pink) | #1E1024 (dark plum) | #FDE8D0 | orange-pink-magenta gradient | Dark mode, gradient-forward trending |
| 7 | **Mint Fresh** | #10B981 (emerald green) | #064E3B (forest) | #ECFDF5 | #1a1a1a | mint-emerald-teal | Clean, fresh, organic |

### Key Design Decisions
- **Neon Demonic** and **Blaze Orange** use dark backgrounds with bright primary colors (dark-mode storefronts) -- exactly matching the uploaded references
- **Aurora Gradient** and **Sunset Fusion** are the 2 gradient/modern/trending dark-mode palettes with multi-color marquee gradients
- All 7 have proper contrast ratios; the existing `isLightColor` logic will auto-compute button text color
- No new CSS variables needed -- all work within the existing theme engine

### File Changes
| File | Change |
|------|--------|
| `src/pages/StoreThemeSettings.tsx` | Append 7 new entries to `COLOR_COMBINATIONS` array (lines 36-108) |

No database or CSS changes required.

