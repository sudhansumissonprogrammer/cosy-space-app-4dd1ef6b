/**
 * Wristlife-only PDP sections.
 *
 * Rendered exclusively for stores in PDP_CUSTOM_SECTION_STORES (see config.ts),
 * lazy-loaded and wrapped in DeferUntilVisible by ProductDetail — so this file
 * never reaches shoppers of any other store.
 *
 * Add a new section:
 *   1. Write a small component below (keep it self-contained).
 *   2. Render it in the `slot` branch where it belongs.
 * Slots:
 *   "after-info"  — right below product info / accordions, above reviews
 *   "after-related" — bottom of the page, below the product carousels
 */

import ParcelAssuranceSection from "./ParcelAssuranceSection";

interface Props {
  slot: "after-info" | "after-related";
  product: any;
  store: any;
}

export default function WristlifeSections({ slot, product, store }: Props) {
  if (slot === "after-info") {
    return (
      <div className="space-y-6">
        <ParcelAssuranceSection product={product} store={store} />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Sections that belong at the bottom of the page go here. */}
    </div>
  );
}
