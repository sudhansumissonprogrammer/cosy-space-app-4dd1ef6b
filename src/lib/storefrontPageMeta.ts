/** Only routes without their own metadata owner belong here. */
const PAGE_LABELS: Record<string, string> = {
  categories: "Browse categories",
  contact: "Contact",
  "contact-us": "Contact",
  "return-policy": "Return & Refund Policy",
  "shipping-policy": "Shipping Policy",
  terms: "Terms & Conditions",
  "privacy-policy": "Privacy Policy",
};

export function storefrontPageMeta(pathname: string, store: { name: string; slug: string }) {
  const prefix = `/store/${store.slug}`;
  const path = pathname === prefix || pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
  const route = path.replace(/^\/+|\/+$/g, "");
  const label = PAGE_LABELS[route];
  return label ? { title: route === "contact" || route === "contact-us" ? `Contact ${store.name}` : `${label} — ${store.name}`, canonicalPath: route } : null;
}