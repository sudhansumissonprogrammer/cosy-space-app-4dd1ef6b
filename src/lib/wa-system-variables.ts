// System-supplied variables that producers (wa-order-event, wa-cart-recovery-cron,
// wa-platform-send branding) automatically resolve per recipient. Use the `key`
// in platform_wa_templates.variables[] for each {{n}} position.

export type WASystemVar = {
  key: string;
  label: string;
  description: string;
  example: string;
  scope: "all" | "order" | "cart" | "branding";
};

export const WA_SYSTEM_VARIABLES: WASystemVar[] = [
  // Branding (resolved from `stores` for every template)
  { key: "customer_name", label: "Customer name", description: "Recipient's first name (falls back to 'there')", example: "Rahul", scope: "branding" },
  { key: "store_name", label: "Store name", description: "Merchant's brand name from `stores.name`", example: "Serdiya Jewellers", scope: "branding" },
  { key: "store_phone", label: "Store phone", description: "Merchant support number", example: "+91 98765 43210", scope: "branding" },
  { key: "store_website", label: "Store website", description: "Custom domain or <slug>.shopbanao.in", example: "https://serdiyajewellers.shop", scope: "branding" },

  // Order events (order_confirmation, order_shipped)
  { key: "product_name", label: "Product name", description: "Primary item name + count (e.g. 'Gold Ring +2 more')", example: "Gold Ring +2 more", scope: "order" },
  { key: "item_count", label: "Item count", description: "Total quantity in the order", example: "3", scope: "order" },
  { key: "order_total", label: "Order total", description: "Formatted ₹ amount", example: "₹2,499", scope: "order" },
  { key: "order_number", label: "Order number", description: "Merchant-facing order number", example: "SDJ-1042", scope: "order" },
  { key: "payment_status_line", label: "Payment status line", description: "COD / paid / partial-paid sentence", example: "Pay ₹2,499 to delivery partner.", scope: "order" },
  { key: "expected_delivery", label: "Expected delivery", description: "Auto-computed day + date (skips Sundays)", example: "Mon, 6 Sep", scope: "order" },
  { key: "courier_name", label: "Courier name", description: "Shipping carrier (shipped event only)", example: "Delhivery", scope: "order" },
  { key: "tracking_number", label: "Tracking number", description: "AWB / consignment id (shipped event only)", example: "DL192837465", scope: "order" },

  // Cart recovery
  { key: "cart_total", label: "Cart total", description: "Formatted ₹ value of abandoned cart", example: "₹1,899", scope: "cart" },
  { key: "product_title", label: "Product title", description: "Name of the first item in the abandoned cart (single product focus)", example: "Gold Ring", scope: "cart" },
  { key: "product_price", label: "Product price", description: "Formatted ₹ unit price of the first item in the abandoned cart", example: "₹1,899", scope: "cart" },

  // Branded short-link token (consumed by URL buttons → shopbanao.in/r/{{1}})
  { key: "cta_token", label: "CTA link token", description: "Branded short token: o-<order>, t-<order>, c-<cart>. Use inside a URL button as https://shopbanao.in/r/{{n}}.", example: "o-3f9c…", scope: "all" },
];

export function getSystemVar(key: string): WASystemVar | undefined {
  return WA_SYSTEM_VARIABLES.find(v => v.key === key);
}
