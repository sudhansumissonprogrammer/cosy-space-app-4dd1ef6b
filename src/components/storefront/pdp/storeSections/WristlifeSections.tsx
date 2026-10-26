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
import QualityAssuranceGrid from "./QualityAssuranceGrid";
import PdpFaqSection from "./PdpFaqSection";
import { isUtkalContentStore } from "../../../../../supabase/functions/_shared/utkalContent";

interface Props {
  slot: "under-gallery" | "under-price" | "after-info" | "after-related";
  product: any;
  store: any;
}

export default function WristlifeSections({ slot, product, store }: Props) {
  // The Utkal catalogue has no verified catalogue-wide movement/material,
  // water-resistance or warranty evidence for these generic assurances.
  if (isUtkalContentStore(store)) return null;
  if (slot === "under-gallery") {
    return (
      <div className="mb-4">
        <ParcelAssuranceSection product={product} store={store} />
      </div>
    );
  }

  if (slot === "under-price") {
    return <QualityAssuranceGrid />;
  }


  if (slot === "after-info") {
    return null;
  }

  return (
    <div className="mt-8 space-y-8">
      <PdpFaqSection />
    </div>
  );
}
