

## Theme System for Storefronts

### Concept
Add a `theme` column to the `stores` table (default: `"theme-1"`). During store creation, add a new step where users pick a theme visually. The storefront layout and components render differently based on the store's theme value.

### Database Change
- Add `theme` column to `stores` table: `text NOT NULL DEFAULT 'theme-1'`

### Store Creation Changes (`src/pages/CreateStore.tsx`)
- Add a new **Step 5: "Choose Theme"** after the Social step
- Update `STEPS` array to include `{ id: 5, title: "Theme", icon: Palette, desc: "Pick a look" }`
- Show theme cards (Theme 1 with preview thumbnail, Theme 2/3/4 as "Coming Soon" greyed out)
- Store selected theme in state, include in the insert payload
- Move the submit action to step 5 instead of step 4

### Storefront Rendering
- **`StorefrontLayout.tsx`**: Pass `store.theme` via outlet context
- **`StorefrontHome.tsx`**: Conditionally render theme-specific layout. For now, only `theme-1` has real components; others will fall back to `theme-1`
- Current storefront components (`StorefrontHero`, `StorefrontCategories`, `StorefrontProductCard`, `StorefrontAbout`) become **Theme 1** components — no rename needed, just used when `theme === "theme-1"`
- Future themes will have their own component sets (e.g., `src/components/storefront/theme-2/`)

### Store Settings (`src/pages/StoreSettings.tsx`)
- Add theme selector so existing store owners can change their theme later

### Files to Change
1. **DB migration**: Add `theme` column to `stores`
2. **`src/pages/CreateStore.tsx`**: Add step 5 with theme picker UI
3. **`src/layouts/StorefrontLayout.tsx`**: Ensure theme is passed in context
4. **`src/pages/StoreSettings.tsx`**: Add theme change option

### What's NOT changing now
- No new theme designs — only Theme 1 is active; Themes 2-4 show as "Coming Soon"
- Current storefront files stay as-is (they are Theme 1)

