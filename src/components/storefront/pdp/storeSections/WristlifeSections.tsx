/**
 * Wristlife-only PDP sections.
 *
 * Rendered exclusively for stores in PDP_CUSTOM_SECTION_STORES (see config.ts),
 * lazy-loaded by ProductDetail — so this file never reaches shoppers of any
 * other store.
 *
 * Slots:
 *   "under-gallery"  — directly under the product photo, above the title
 *   "after-info"     — below product info / accordions, above reviews
 *   "after-related"  — bottom of the page, below the product carousels
 */

import ParcelAssuranceSection from "./ParcelAssuranceSection";

interface Props {
  slot: "under-gallery" | "after-info" | "after-related";
  product: any;
  store: any;
}

export default function WristlifeSections({ slot, product, store }: Props) {
  if (slot === "under-gallery") {
    return (
      <div className="mb-4">
        <ParcelAssuranceSection product={product} store={store} />
      </div>
    );
  }

  if (slot === "after-info") {
    return null;
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Sections that belong at the bottom of the page go here. */}
    </div>
  );
}
