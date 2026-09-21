// Ekart Logistics direct integration.
// Actions: serviceability | create | track | cancel

import {
  corsHeaders, json, authedUser, assertStoreOwner,
  loadProvider, serviceClient,
} from "../_shared/shipping.ts";

function baseUrl(sandbox: boolean) {
  return sandbox
    ? "https://staging-api.ekartlogistics.com"
    : "https://api.ekartlogistics.com";
}

async function ek(cfg: any, method: string, path: string, body?: unknown) {
  const r = await fetch(baseUrl(cfg.sandbox) + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Merchant-Code": cfg.client_id ?? "",
      "X-Api-Auth-Key": cfg.api_key ?? "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`Ekart ${method} ${path} [${r.status}]: ${text}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await authedUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const { action, store_id, ...args } = await req.json();
    if (!action || !store_id) return json({ error: "missing action/store_id" }, 400);
    await assertStoreOwner(user.id, store_id);
    const cfg = await loadProvider(store_id, "ekart");
    const svc = serviceClient();

    switch (action) {
      case "serviceability": {
        const d = await ek(cfg, "POST", "/v2/serviceability", {
          source_pincode: args.pickup_pincode,
          destination_pincode: args.delivery_pincode,
          payment_mode: args.cod ? "COD" : "PREPAID",
          weight: args.weight_grams ?? 500,
        });
        return json({ result: d });
      }

      case "create": {
        const { data: order } = await svc.from("orders").select("*").eq("id", args.order_id).maybeSingle();
        if (!order) return json({ error: "order not found" }, 404);
        if (order.store_id !== store_id) return json({ error: "order does not belong to this store" }, 403);
        if (order.status === "cancelled") {
          return json({ error: "Canceled orders are permanently locked and cannot be shipped." }, 409);
        }
        const { data: items } = await svc.from("order_items").select("*").eq("order_id", args.order_id);
        const { data: pickup } = await svc.from("store_pickup_addresses")
          .select("*").eq("store_id", store_id).eq("is_default", true).maybeSingle();
        if (!pickup) return json({ error: "add a default pickup address first" }, 400);

        const payload = {
          merchant_reference: `SB-${order.order_number ?? order.id.slice(0, 8)}`,
          service_type: args.service_type ?? "STANDARD",
          payment_mode: order.payment_method === "cod" ? "COD" : "PREPAID",
          cod_amount: order.payment_method === "cod" ? Number(order.total ?? 0) : 0,
          declared_value: Number(order.total ?? 0),
          weight: args.weight_grams ?? 500,
          dimensions: {
            length: args.length_cm ?? 10,
            breadth: args.breadth_cm ?? 10,
            height: args.height_cm ?? 10,
          },
          pickup: {
            name: pickup.contact_name, phone: pickup.phone,
            address_line1: pickup.address_line1, address_line2: pickup.address_line2 ?? "",
            city: pickup.city, state: pickup.state, pincode: pickup.pincode, country: "India",
          },
          drop: {
            name: order.customer_name ?? "Customer", phone: order.customer_phone ?? "",
            address_line1: order.street_address ?? "",
            city: order.city ?? "", state: order.state ?? "",
            pincode: order.pincode ?? "", country: "India",
          },
          items: (items ?? []).map((i: any) => ({
            name: i.product_name ?? "Item",
            sku: i.variant_sku ?? "",
            quantity: i.quantity ?? 1,
            unit_price: Number(i.price ?? 0),
          })),
        };
        const d = await ek(cfg, "POST", "/v2/shipments/create", payload);
        const awb = d?.tracking_id ?? d?.awb ?? d?.shipment_id ?? null;

        const { data: ship } = await svc.from("order_shipments").insert({
          order_id: args.order_id, store_id,
          provider: "ekart", courier_name: "Ekart",
          awb, provider_shipment_id: awb,
          tracking_url: awb ? `https://ekartlogistics.com/shipmenttrack/${awb}` : null,
          label_url: d?.label_url ?? null,
          status: awb ? "manifested" : "failed",
          last_error: awb ? null : JSON.stringify(d).slice(0, 500),
          weight_grams: args.weight_grams ?? 500,
          length_cm: args.length_cm ?? 10,
          breadth_cm: args.breadth_cm ?? 10,
          height_cm: args.height_cm ?? 10,
          declared_value: Number(order.total ?? 0),
          cod_amount: order.payment_method === "cod" ? Number(order.total ?? 0) : 0,
          payment_mode: order.payment_method === "cod" ? "cod" : "prepaid",
          pickup_address_id: pickup.id,
          raw_payload: d,
        }).select().single();

        if (awb) {
          await svc.from("orders").update({
            tracking_number: awb,
            tracking_url: `https://ekartlogistics.com/shipmenttrack/${awb}`,
          }).eq("id", args.order_id);
        }
        return json({ shipment: ship });
      }

      case "track": {
        const r = await fetch(`${baseUrl(cfg.sandbox)}/v2/track/${args.awb}`, {
          headers: {
            "X-Merchant-Code": cfg.client_id ?? "",
            "X-Api-Auth-Key": cfg.api_key ?? "",
          },
        });
        const d = await r.json();
        return json({ tracking: d });
      }

      case "cancel": {
        const d = await ek(cfg, "POST", "/v2/shipments/cancel", {
          tracking_id: args.awb,
          reason: args.reason ?? "Merchant cancelled",
        });
        await svc.from("order_shipments").update({ status: "cancelled" }).eq("id", args.shipment_id);
        return json({ result: d });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("ekart error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
