// Bundled courier brand marks. Scraped once from each courier's own site
// (or Wikimedia Commons for brands whose sites block hotlinking) and served
// from our own origin — no third-party favicon service that can fail, get
// blocked, or rate-limit.
import amazon_shipping from "@/assets/couriers/amazon_shipping.png";
import bluedart from "@/assets/couriers/bluedart.png";
import delhivery from "@/assets/couriers/delhivery.png";
import dtdc from "@/assets/couriers/dtdc.png";
import ekart from "@/assets/couriers/ekart.png";
import india_post from "@/assets/couriers/india_post.png";
import xpressbees from "@/assets/couriers/xpressbees.png";
import shiprocket from "@/assets/couriers/shiprocket.svg";
import shadowfax from "@/assets/couriers/shadowfax.svg";
import ecom_express from "@/assets/couriers/ecom_express.svg";

export const COURIER_LOGOS: Record<string, string> = {
  amazon_shipping,
  bluedart,
  delhivery,
  dtdc,
  ekart,
  india_post,
  xpressbees,
  shiprocket,
  shadowfax,
  ecom_express,
};

/** Wordmark logos are wide — render them edge-to-edge instead of as a dot. */
export const WIDE_LOGOS = new Set(["bluedart", "dtdc", "india_post", "shiprocket", "shadowfax", "ecom_express", "xpressbees"]);

export function courierLogoSrc(slug?: string | null): string | null {
  if (!slug) return null;
  return COURIER_LOGOS[slug] ?? null;
}
