import { supabase } from "@/integrations/supabase/client";

/**
 * Attempts to send an automated WhatsApp message for an order event.
 * Silently fails if WhatsApp is not configured for the store.
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

    // Check if WhatsApp is configured
    const { data: config } = await supabase
      .from("whatsapp_config")
      .select("id, is_active")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .maybeSingle();

    if (!config) return;

    // Get the template for this message type
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("body_text, is_active")
      .eq("store_id", storeId)
      .eq("template_type", messageType)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) return;

    // Replace template variables
    let body = (template as any).body_text || "";
    body = body.replace(/\{\{name\}\}/g, orderData.customer_name || "Customer");
    body = body.replace(/\{\{order_id\}\}/g, orderId.slice(0, 8).toUpperCase());
    body = body.replace(/\{\{total\}\}/g, `${orderData.currency || "₹"}${orderData.total || 0}`);
    body = body.replace(/\{\{tracking_url\}\}/g, orderData.tracking_url || "");
    body = body.replace(/\{\{tracking_number\}\}/g, orderData.tracking_number || "");
    body = body.replace(/\{\{product_names\}\}/g, orderData.product_names || "your items");
    body = body.replace(/\{\{store_name\}\}/g, orderData.store_name || "our store");
    body = body.replace(/\{\{currency\}\}/g, orderData.currency || "₹");

    // Send via edge function (fire and forget)
    supabase.functions.invoke("whatsapp-send", {
      body: {
        store_id: storeId,
        recipient_phone: orderData.customer_phone,
        recipient_name: orderData.customer_name,
        message_body: body,
        message_type: messageType,
        order_id: orderId,
      },
    }).catch(console.error);
  } catch (err) {
    // Silently fail - WhatsApp is optional
    console.error("WhatsApp auto-send failed:", err);
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
    const { data: config } = await supabase
      .from("whatsapp_config")
      .select("id, is_active")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .maybeSingle();

    if (!config) return;

    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("body_text, is_active")
      .eq("store_id", storeId)
      .eq("template_type", "abandoned_cart")
      .eq("is_active", true)
      .maybeSingle();

    if (!template) return;

    let body = (template as any).body_text || "";
    body = body.replace(/\{\{name\}\}/g, customerName || "Customer");
    body = body.replace(/\{\{product_names\}\}/g, cartData?.product_names || "your items");
    body = body.replace(/\{\{cart_total\}\}/g, cartData?.cart_total ? `${cartData.currency || "₹"}${cartData.cart_total}` : "");
    body = body.replace(/\{\{store_name\}\}/g, cartData?.store_name || "our store");
    body = body.replace(/\{\{currency\}\}/g, cartData?.currency || "₹");

    supabase.functions.invoke("whatsapp-send", {
      body: {
        store_id: storeId,
        recipient_phone: customerPhone,
        message_body: body,
        message_type: "abandoned_cart",
        abandoned_cart_id: abandonedCartId,
      },
    }).catch(console.error);
  } catch (err) {
    console.error("WhatsApp cart recovery failed:", err);
  }
}
