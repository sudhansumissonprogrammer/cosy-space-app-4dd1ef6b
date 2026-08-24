/**
 * Store-scoped PDP sections.
 *
 * Only stores listed here load ANY of this code — the container is lazy +
 * deferred, so every other storefront pays exactly zero JS / paint cost.
 *
 * To enable for another store later, add its slug here.
 */
export const PDP_CUSTOM_SECTION_STORES = new Set<string>(["wristlife", "hopknock"]);

export function hasCustomPdpSections(slug?: string | null): boolean {
  return !!slug && PDP_CUSTOM_SECTION_STORES.has(slug);
}
