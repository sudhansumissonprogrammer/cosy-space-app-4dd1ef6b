# Customizable Nav Icons — Plan

Goal: Let the merchant pick which icon represents each nav slot (Home, Shop, Categories, Cart, Orders, Search, Menu, Wishlist, Account). 4–5 choices per slot. Works in:
- Desktop / mobile header (MobileAppHeader + theme headers)
- Side drawer menu
- All 3 mobile bottom nav variants (Classic, Modern, Streetwear/V15) — V17 keeps its custom design
- Across all 20 themes, no conflict, no late-loading flicker

---

## 1. Icon Registry (single source of truth)

Create `src/lib/navIconRegistry.ts`:

```ts
// Static import — all icons ship in one tiny chunk, zero runtime fetch
import { Home, House, HomeIcon as Home3, ... ShoppingBag, ShoppingCart, Store, Storefront, ... } from "lucide-react";

export type NavSlot =
  | "home" | "shop" | "categories" | "cart" | "orders"
  | "search" | "menu" | "wishlist" | "account";

export const ICON_OPTIONS: Record<NavSlot, { id: string; label: string; Icon: LucideIcon }[]> = {
  home:       [{ id: "home",  label: "Classic", Icon: Home },  { id: "house", ... }, ...],
  shop:       [{ id: "bag",   label: "Bag",     Icon: ShoppingBag }, ...],
  cart:       [{ id: "cart",  label: "Cart",    Icon: ShoppingCart }, ...],
  // ... 4–5 per slot
};

export const DEFAULT_ICONS: Record<NavSlot, string> = {
  home: "home", shop: "bag", categories: "grid",
  cart: "cart", orders: "clipboard", search: "search",
  menu: "menu", wishlist: "heart", account: "user",
};
```

All lucide icons are tree-shaken and tiny (~300 bytes each gzipped). Static imports = zero loading delay, zero flicker.

## 2. Storage

Extend `storefront_themes.config` JSONB (no migration needed — it's already a free-form JSON column) with:

```json
{
  "nav_icons": {
    "home": "house",
    "cart": "basket",
    "...": "..."
  }
}
```

Independent from `mobile_nav_style`. Switching Classic → Modern keeps the same icon picks. Missing keys fall back to `DEFAULT_ICONS`.

## 3. Resolver hook

`src/hooks/useNavIcons.ts`:

```ts
export function useNavIcons() {
  const { themeConfig } = useStorefront();
  const picks = themeConfig?.nav_icons ?? {};
  return (slot: NavSlot) => {
    const id = picks[slot] ?? DEFAULT_ICONS[slot];
    const opt = ICON_OPTIONS[slot].find(o => o.id === id) ?? ICON_OPTIONS[slot][0];
    return opt.Icon;
  };
}
```

Components use:
```tsx
const getIcon = useNavIcons();
const HomeIcon = getIcon("home");
<HomeIcon className="..." />
```

Since icons are statically imported, this is a synchronous lookup — paint is instant on first render, no flicker, no skeleton, no late-load.

## 4. Refactor consumers (small, surgical)

Replace hard-coded `Home`, `ShoppingCart` etc. with `getIcon("slot")` in:
- `MobileBottomNav.tsx` (Classic)
- `MobileBottomNavModern.tsx`
- `MobileBottomNavV15.tsx` (Streetwear)
- `MobileAppHeader.tsx` (menu + search + cart)
- Drawer menu items (where applicable in theme layouts)
- V17 left alone (custom artwork — opt-out documented)

Each variant keeps its own size / strokeWidth / styling — only the icon component swaps. No layout change, no conflict between variants.

## 5. Admin UI — "Icon Picker"

New section in `StoreThemeSettings.tsx` (Theme tab → "Nav Icons" panel), independent from the "Mobile Bottom Nav Style" picker so they don't fight:

```
Nav Icons
─────────
Home        [○ Home] [● House] [○ Home3] [○ Cabin] [○ Roof]
Shop        [● Bag]  [○ Store] [○ Tag] ...
Cart        [● Cart] [○ Basket] [○ Bag2] ...
...
Categories  ...
                                              [Reset to defaults]
```

- Render each row as a horizontal radio of actual icon previews (uses same `ICON_OPTIONS` registry).
- Currently active option is preselected ("ther option of that people can chage to this after they did any chages" — current = default until they pick another).
- Save writes `config.nav_icons` via existing theme save mutation.
- Live preview in the existing mobile preview drawer updates instantly because it consumes the same hook.

## 6. Safety / no-conflict rules

- **Independence**: `mobile_nav_style` controls layout; `nav_icons` controls glyph. Either can change without breaking the other.
- **Fallback**: any unknown id → default. Old stores keep working with no DB write.
- **No SSR/edge cache break**: `nav_icons` rides inside the same `storefront_themes.config` that's already cached at the edge; no new RPC, no new round-trip.
- **No new bundle cost**: ~25 extra lucide icons static-imported = <8 KB gzipped, lands in the same nav switcher chunk.
- **No runtime fetch**: nothing async, so zero late-paint / icon swap flicker.
- **Per-theme works**: every theme already reads from `useStorefrontThemeConfig`, so V1–V21 all pick this up automatically.
- **V17 opt-out**: documented; its custom-designed icons stay.

## 7. Rollout steps (in order)

1. You upload the 4–5 icon choices per slot (or I pick the best lucide options if you want lucide-only).
2. Add `navIconRegistry.ts` + `useNavIcons.ts`.
3. Refactor the 3 bottom navs + MobileAppHeader to use `getIcon()`.
4. Add Icon Picker panel in `StoreThemeSettings`.
5. QA each of the 3 nav variants × a couple of themes on mobile viewport.

---

**Ready to build whenever you say go.** If you want to upload the icon set first, share them; otherwise I'll seed each slot with 5 hand-picked lucide options and you can swap any later.