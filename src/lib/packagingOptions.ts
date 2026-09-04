/**
 * PDP packaging upgrade add-ons (wristlife / hopknock).
 *
 * The surcharge is added on TOP of the product's sale price. The client only
 * ever sends the option key — `place-order` re-derives the surcharge from this
 * same table server-side, so the price can't be tampered with.
 */

export type PackagingKey = "complimentary" | "signature" | "brandkit";

export interface PackagingOption {
  key: PackagingKey;
  label: string;
  /** Extra amount added to the unit price (INR). */
  surcharge: number;
  /** Short line shown under the label. */
  note?: string;
}

export const PACKAGING_OPTIONS: PackagingOption[] = [
  { key: "complimentary", label: "Complimentary Box", surcharge: 0, note: "Standard gift packaging — free" },
  { key: "signature", label: "Utkal Signature Box", surcharge: 100, note: "Premium magnetic box + ribbon" },
  { key: "brandkit", label: "With OG Brand Kit", surcharge: 200, note: "Brand box, card, pouch & tools" },
];

export const DEFAULT_PACKAGING: PackagingKey = "complimentary";

export function getPackagingOption(key?: string | null): PackagingOption {
  return PACKAGING_OPTIONS.find((o) => o.key === key) ?? PACKAGING_OPTIONS[0];
}

export function packagingSurcharge(key?: string | null): number {
  return getPackagingOption(key).surcharge;
}
