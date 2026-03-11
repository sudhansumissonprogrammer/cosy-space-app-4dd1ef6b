

## Replace Individual Color Pickers with Color Combination Presets

### Current State
The "Customize Theme" section has 4 individual color pickers (Primary, Accent, Text, Background) where users pick each color manually. This is overwhelming and can lead to bad color combinations.

### Plan
Replace the 4 color pickers with **3 pre-designed color combination cards** that users click to apply. Each combination sets all 4 colors + matching marquee gradient at once.

### Color Combinations

| Name | Primary | Accent | Text | Background | Marquee |
|------|---------|--------|------|------------|---------|
| **Royal Gold** (current default) | #b8873c | #000000 | #1a1a1a | #f7f5f0 | gold gradient |
| **Midnight Rose** | #b76e79 | #2d2d2d | #1a1a1a | #fdf8f8 | rose gold gradient |
| **Ocean Luxe** | #1e3a5f | #c9a84c | #1a1a1a | #f5f7fa | ocean blue gradient |

### UI Design
- Replace the 4 `ColorPicker` components + grid with a horizontal grid of 3 clickable cards
- Each card shows: a color swatch strip (gradient of the 4 colors), the combination name, and a check/selected indicator
- Clicking a card applies all 4 colors + marquee gradient instantly (marks form as dirty)
- Keep the rest of the customization (fonts, button style, marquee override) unchanged

### Files to Modify
- `src/pages/StoreThemeSettings.tsx` — replace the Colors section with combination preset cards, add `COLOR_COMBINATIONS` constant

No database changes needed — the same `store_theme_config` columns are used, just pre-filled from presets instead of individual pickers.

