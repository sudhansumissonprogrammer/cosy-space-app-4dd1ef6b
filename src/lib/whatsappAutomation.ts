import { supabase } from "@/integrations/supabase/client";

/**
 * Attempts to send an automated WhatsApp message for an order event.
 * Works with both ShopBanao mode (platform credentials) and Own mode (store credentials).
 * Silently fails if WhatsApp is not configured at all.
 */
export async function sendOrderWhatsApp(
  storeId: string,
  orderId: string,
  messageType: "order_confirmation" | "shipping_update" | "delivery_confirmation",
  orderData: {
    customer_phone?: string | null;
    customer_name?: string | null;
    total?: number;
    currency?: string;
    tracking_url?: string | null;
    tracking_number?: string | null;
    product_names?: string;
    store_name?: string;
  }
) {
  try {
    if (!orderData.customer_phone) return;

    // SECURITY/POLICY: WhatsApp automation is GATED behind store-owned,
    // verified Meta Cloud credentials. No platform fallback is performed.
    const { data: config } = await supabase
      .from("whatsapp_config")
      .select("id, is_active, phone_number_id" as any)
      .eq("store_id", storeId)
      .maybeSingle();

    const c = config as any;
    if (!c || !c.is_active || !c.phone_number_id) return;

    // Get the template for this message type
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("body_text, is_active")
      .eq("store_id", storeId)
      .eq("template_type", messageType)
      .eq("is_active", true)
      .maybeSingle();

    // Require an active per-store template (no platform defaults).
    let body = "";
    if (template) {
      body = (template as any).body_text || "";
    } else {
      return; // No template configured for this store
    }

    // Replace template variables
    body = body.replace(/\{\{name\}\}/g, orderData.customer_name || "Customer");
    body = body.replace(/\{\{order_id\}\}/g, orderId.slice(0, 8).toUpperCase());
    body = body.replace(/\{\{total\}\}/g, `${orderData.currency || "₹"}${orderData.total || 0}`);
    body = body.replace(/\{\{tracking_url\}\}/g, orderData.tracking_url || "");
    body = body.replace(/\{\{tracking_number\}\}/g, orderData.tracking_number || "");
    body = body.replace(/\{\{product_names\}\}/g, orderData.product_names || "your items");
    body = body.replace(/\{\{store_name\}\}/g, orderData.store_name || "our store");
    body = body.replace(/\{\{currency\}\}/g, orderData.currency || "₹");

    // ⚠️ WhatsApp auto-send temporarily disabled — feature coming soon
    // Re-enable by uncommenting once Meta WhatsApp Business API is configured.
    void body; void storeId; void orderId; void messageType;
    // supabase.functions.invoke("whatsapp-send", { ... }).catch(console.error);
  } catch (err) {
    console.error("WhatsApp auto-send skipped:", err);
  }
}

/**
 * Send abandoned cart recovery message
 */
export async function sendAbandonedCartWhatsApp(
  storeId: string,
  abandonedCartId: string,
  customerPhone: string,
  customerName?: string,
  cartData?: {
    product_names?: string;
    cart_total?: number;
    currency?: string;
    store_name?: string;
  }
) {
  try {
    // SECURITY/POLICY: cart recovery is gated behind verified store-owned credentials.
    const { data: config } = await supabase
      .from("whatsapp_config")
      .select("id, is_active, access_token, phone_number_id" as any)
      .eq("store_id", storeId)
      .maybeSingle();

    const c = config as any;
    if (!c || !c.is_active || !c.access_token || !c.phone_number_id) return;

    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("body_text, is_active")
      .eq("store_id", storeId)
      .eq("template_type", "abandoned_cart")
      .eq("is_active", true)
      .maybeSingle();

    if (!template) return;
    let body = (template as any).body_text || "";
    if (!body) return;

    body = body.replace(/\{\{name\}\}/g, customerName || "Customer");
    body = body.replace(/\{\{product_names\}\}/g, cartData?.product_names || "your items");
    body = body.replace(/\{\{cart_total\}\}/g, cartData?.cart_total ? `${cartData.currency || "₹"}${cartData.cart_total}` : "");
    body = body.replace(/\{\{store_name\}\}/g, cartData?.store_name || "our store");
    body = body.replace(/\{\{currency\}\}/g, cartData?.currency || "₹");

    // ⚠️ WhatsApp cart recovery temporarily disabled — feature coming soon
    void body; void storeId; void customerPhone; void abandonedCartId;
  } catch (err) {
    console.error("WhatsApp cart recovery skipped:", err);
  }
}
