# Dark Streetwear Toggle — Classic + Quick Buy theme only

Add a premium night-mode toggle to the header of the **Classic + Quick Buy** theme (theme-16). Light stays the default; nothing about the current look changes until a shopper taps the toggle. Checkout is never affected.

## Behaviour

- Toggle sits in the mobile header action row and in the desktop nav icon row (only for this theme — no other theme sees it).
- Off by default for every visitor. Choice is remembered on the shopper's device.
- When on: every storefront page (home, category, product detail, cart, wishlist, account, custom pages, search, side cart, dialogs) switches to the all-black editorial palette used by the Dark Streetwear theme: background `#0a0a0a`, surfaces `#141414`, text `#f2f2f2`, secondary text `#a8a8a8`, hairline borders at 12% white.
- Checkout stays exactly as it is today. Entering `/checkout` removes the dark class; leaving it restores the shopper's choice.
- When off, the rendered DOM/CSS is byte-identical to today — the dark rules only exist under a root class that isn't present.

## Toggle design

Compact pill, 40x40 tap target, glass surface (`backdrop-blur`, 1px hairline border), moon glyph in light mode / sun glyph in dark, 200ms crossfade + slight rotate on switch, `aria-pressed` + label for screen readers, honors `prefers-reduced-motion`.

## Legibility

The palette flip is done with tokens first (`--storefront-bg`, `--storefront-text`, and the shadcn `--background / --foreground / --card / --muted / --border / --popover` set), which most storefront components already read. On top of that, a scoped override sheet remaps the hardcoded utility classes that exist in the shared classic pages so no text can end up invisible:

- `bg-white`, `bg-gray-50/100`, `bg-slate-50`, `bg-neutral-50` -> dark surfaces
- `text-black`, `text-gray-900/800/700` -> `#f2f2f2`
- `text-gray-600/500/400` -> `#a8a8a8`
- `border-gray-*`, `border-white` -> `rgba(255,255,255,0.12)`
- shadows softened; product images untouched (no filters applied)

After implementation I will run the storefront in the sandbox browser with dark on and screenshot home, product detail, cart, search overlay and side cart to confirm no low-contrast or invisible text, then confirm checkout renders unchanged.

## Performance

- The dark stylesheet and the toggle component are imported by the theme-16 layout chunk only, so no other theme or the landing page ships a single extra byte.
- The saved preference is read synchronously in a layout effect before the storefront tree paints, so returning dark-mode shoppers get no white flash and no extra network request.
- No new state provider, no re-render of the product grid on toggle — the switch is a single class on `<html>`.

## Technical notes

- New `src/lib/sfDarkMode.ts`: localStorage read/write, `applySfDarkClass`, `sf-dark-change` event, `isCheckoutPath` guard.
- New `src/styles/sf-dark.css`: all rules scoped under `html.sf-dark`.
- New `src/components/storefront/SfDarkToggle.tsx`: the button, subscribes to the change event and route changes.
- `CheckoutAwareLayout.tsx`: optional `showDarkToggle` prop, renders the toggle in the mobile action row and forwards it to `DesktopNavBar`.
- `DesktopNavBar.tsx`: optional `extra` node rendered at the start of the right-hand icon group.
- `StorefrontLayoutV16.tsx`: imports the stylesheet, applies the saved class on mount, clears it on unmount, passes `showDarkToggle`.

No backend, data, or checkout logic is touched.
