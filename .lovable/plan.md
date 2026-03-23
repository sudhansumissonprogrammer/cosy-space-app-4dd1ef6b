

## Plan: Reduce Render-Blocking CSS & JS Payload

### Analysis Summary

**Current state:**
- Single monolithic `index.css` (207 lines) compiled by Tailwind into one large CSS bundle — loaded for ALL contexts (storefront, admin, dashboard)
- `App.css` (42 lines) is **dead code** — not imported anywhere
- `App.tsx` eagerly imports `Toaster`, `Sonner`, `TooltipProvider`, `QueryClient`, `react-router-dom`, `ErrorBoundary`, `logError`, and `subdomain` — all parsed before first paint
- `main.tsx` eagerly imports `App.tsx` + `index.css` + `logError` (includes `initGlobalErrorHandlers` with fetch setup)
- JS entry chain: `main.tsx` → `App.tsx` → eagerly pulls in `@tanstack/react-query`, `react-router-dom`, `@radix-ui/tooltip`, toast UI components — all render-blocking
- Theme JS is already lazy-loaded (good), but the CSS for all themes shares the same monolithic stylesheet

**Key bottlenecks:**
1. One CSS file for all contexts — storefront loads admin/dashboard vars, dark mode, sidebar vars it never uses
2. Eager imports of toast/tooltip UI components in App.tsx add to critical bundle
3. `App.css` is dead weight in the repo
4. No CSS code splitting by route context despite `cssCodeSplit: true` in Vite (only works when CSS is imported in lazy chunks)

---

### Changes

#### 1. Delete Dead `App.css`
- **File:** `src/App.css` — delete entirely
- Contains unused `.logo`, `.read-the-docs`, `.card` styles from Vite boilerplate
- Not imported anywhere — pure dead code

#### 2. Lazy-Load Toast & Sonner Components
- **File:** `src/App.tsx`
- Move `Toaster` and `Sonner` to lazy imports — they are never visible on first paint (only appear on user interactions)
- This removes `@radix-ui/react-toast` and `sonner` from the critical JS bundle

```
Before (eager):  import { Toaster } from "@/components/ui/toaster";
After (lazy):    const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
```

#### 3. Split CSS: Storefront vs Dashboard/Admin
- **File:** `src/index.css` — keep only shared base styles (CSS variables, reset, body, border-border)
- **New file:** `src/styles/storefront.css` — move storefront-specific styles (`.storefront-font`, `.btn-gold`, `.animate-marquee`, `.safe-area-bottom`, storefront CSS custom properties, keyframes for `marquee`, `bounce-once`, `confetti-fall`, `float-particle`)
- **New file:** `src/styles/dashboard.css` — move sidebar CSS variables, dark mode overrides, `.scrollbar-hide`
- Import `storefront.css` inside storefront layout components (lazy-loaded → CSS only loads for storefront visitors)
- Import `dashboard.css` inside `DashboardLayout` / `AdminLayout` (lazy-loaded → CSS only loads for dashboard users)
- This leverages Vite's `cssCodeSplit: true` to emit separate CSS chunks per route

#### 4. Remove Dark Mode & Sidebar Vars from Storefront Critical Path
- The `.dark { ... }` block and `--sidebar-*` variables in `index.css` are only used by admin/dashboard
- Move them to `src/styles/dashboard.css`
- Storefront users save ~50 lines of unused CSS parsing

#### 5. Defer `initGlobalErrorHandlers` 
- **File:** `src/main.tsx`
- Move `initGlobalErrorHandlers()` into the existing `postInteractiveSetup()` callback
- Error handlers are not needed before first paint — deferring removes the eager import chain of `logError.ts` (which references `import.meta.env` variables and sets up fetch endpoints)
- The `logError` import in `App.tsx` (used by QueryClient `onError`) is already only triggered on mutations, not on load

#### 6. Trim `index.css` Keyframes
- Remove `confetti-fall`, `float-particle`, `progress-grow` keyframes from `index.css` — these are only used in specific components and should be colocated or moved to `storefront.css`
- Keeps the critical CSS file minimal

---

### Files to Modify

| File | Action |
|------|--------|
| `src/App.css` | **Delete** (dead code) |
| `src/index.css` | Slim down to shared base only (~70 lines) |
| `src/styles/storefront.css` | **Create** — storefront-specific styles |
| `src/styles/dashboard.css` | **Create** — dashboard/admin-specific styles |
| `src/App.tsx` | Lazy-load Toaster + Sonner |
| `src/main.tsx` | Defer `initGlobalErrorHandlers` to idle callback |
| `src/layouts/StorefrontLayout.tsx` | Add `import "@/styles/storefront.css"` |
| `src/layouts/DashboardLayout.tsx` | Add `import "@/styles/dashboard.css"` |
| `src/layouts/AdminLayout.tsx` | Add `import "@/styles/dashboard.css"` |

### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Critical CSS | ~119KB (monolithic) | ~40KB (base only) |
| Storefront CSS | Includes dashboard/admin vars | Only storefront styles |
| Initial JS (storefront) | Includes toast + sonner + error setup | Deferred to idle/interaction |
| Dead CSS files | `App.css` loaded by Vite | Removed |

