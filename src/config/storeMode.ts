/**
 * Single source of truth for the "WhatsApp-only store" mode.
 *
 * Previously this flag was re-declared as a local `const isWhatsAppOnly = false`
 * inside Dashboard.tsx, DashboardLayout.tsx, AppSidebar.tsx and StoreChecklist.tsx,
 * which meant the four copies could silently drift apart. There is no column for
 * it in the database yet, so it stays a build-time constant — but only one.
 *
 * When a per-store column lands, replace this with a hook that reads it and
 * update the four call sites (they already import from here).
 */
export const IS_WHATSAPP_ONLY_STORE = false;
