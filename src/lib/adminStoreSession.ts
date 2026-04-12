/**
 * Lightweight session memory for the admin-viewed store slug.
 * Persists across in-app navigations (including routes without :storeSlug).
 * Cleared when the admin leaves the dashboard or goes back to admin panel.
 */

const KEY = "admin_view_store_slug";

export function setAdminViewSlug(slug: string) {
  sessionStorage.setItem(KEY, slug);
}

export function getAdminViewSlug(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearAdminViewSlug() {
  sessionStorage.removeItem(KEY);
}
