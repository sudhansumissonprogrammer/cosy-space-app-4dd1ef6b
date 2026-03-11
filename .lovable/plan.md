

## Theme Settings — Full Plan

### What We're Building

A new **Theme Settings** page in the dashboard sidebar where store owners can:
1. **Browse & Apply** themes (theme switching between theme-1, future theme-2, etc.)
2. **Customize** each theme's colors and fonts (primary color, accent color, text font, heading font, marquee gradient, button style)

### Database Changes

**New table: `store_theme_config`**
| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| store_id | uuid | FK (unique) |
| primary_color | text | `'#b8873c'` (gold) |
| accent_color | text | `'#000000'` (black) |
| text_color | text | `'#1a1a1a'` |
| background_color | text | `'#f7f5f0'` |
| heading_font | text | `'Alegreya SC'` |
| body_font | text | `'Inter'` |
| button_style | text | `'rounded'` |
| marquee_gradient | text | `'linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a)'` |
| created_at / updated_at | timestamptz | now() |

RLS: Store owners can CRUD own config. Public can SELECT (storefront needs to read it).

### New Route & Page

- **Route**: `/dashboard/stores/:storeId/theme` 
- **Page**: `src/pages/StoreThemeSettings.tsx`
- **Sidebar**: Add "Theme Settings" item with `Palette` icon, positioned before "Store Settings"

### Page Layout (StoreThemeSettings.tsx)

**Section 1 — Theme Selector** (top)
- Grid of theme cards (theme-1 "Classic", theme-2 "Bold" coming soon, etc.)
- Each card: thumbnail/preview, name, "Applied" badge or "Apply" button
- Clicking "Apply" updates `stores.theme` column instantly

**Section 2 — Theme Customization** (below)
- Only shown for the currently applied theme
- Color pickers for: Primary, Accent, Text, Background
- Font selectors (dropdown) for: Heading font, Body font — limited set of Google Fonts
- Marquee gradient editor (3-color picker or presets)
- Button style selector (rounded / pill / square)
- Live mini-preview strip showing how colors/fonts look
- "Save" and "Reset to Default" buttons

### Storefront Integration

- **StorefrontLayout.tsx**: Fetch `store_theme_config` for the current store (add to the existing `get_storefront_data` RPC or as a separate lightweight query)
- Inject CSS custom properties (`--storefront-primary`, `--storefront-accent`, etc.) as inline `style` on the storefront wrapper `<div>`
- Update storefront components (Marquee, buttons, headings) to use these CSS variables instead of hardcoded colors
- Load selected Google Fonts dynamically via `<link>` tag

### Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/pages/StoreThemeSettings.tsx` |
| Modify | `src/components/AppSidebar.tsx` — add Theme Settings link |
| Modify | `src/routes/AuthRoutes.tsx` — add route |
| Modify | `src/layouts/StorefrontLayout.tsx` — fetch & inject theme CSS vars |
| Modify | `src/components/storefront/StorefrontMarquee.tsx` — use CSS vars |
| Modify | `src/index.css` — add storefront CSS variable defaults |
| Migration | Create `store_theme_config` table + RLS policies |
| Migration | Optionally update `get_storefront_data` RPC to include theme config |

### Theme-1 Default Values

```text
Primary:    #b8873c (gold)
Accent:     #000000 (black)
Text:       #1a1a1a (dark)
Background: #f7f5f0 (warm white)
Heading:    Alegreya SC
Body:       Inter
Marquee:    gold gradient
Buttons:    rounded, gold gradient
```

### How Theme Switching Will Work for Future Themes

Each theme (theme-1, theme-2, etc.) will define its own **default palette** and **component layout** in code. When a user switches themes:
1. `stores.theme` updates to the new theme ID
2. `store_theme_config` resets to that theme's defaults (or user keeps custom colors)
3. Storefront components conditionally render based on `store.theme` value

This architecture means theme-2 can have a completely different layout while still supporting per-store color customization.

