// Shiprocket integration edge function.
// Actions: rate | create | track | cancel | label | pickup_locations | register_pickup

import {
  corsHeaders, json, authedUser, assertStoreOwner,
  loadProvider, shiprocketToken, serviceClient,
} from "../_shared/shipping.ts";

const BASE = "https://apiv2.shiprocket.in/v1/external";

async function sr(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`Shiprocket ${method} ${path} [${r.status}]: ${text}`);
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
    const cfg = await loadProvider(store_id, "shiprocket");
    const token = await shiprocketToken(cfg);
    const svc = serviceClient();

    switch (action) {
      case "pickup_locations": {
        const d = await sr(token, "GET", "/settings/company/pickup");
        return json({ locations: d?.data?.shipping_address ?? [] });
      }

      case "rate": {
        const qp = new URLSearchParams({
          pickup_postcode: String(args.pickup_pincode),
          delivery_postcode: String(args.delivery_pincode),
          weight: String(args.weight ?? 0.5),
          cod: args.cod ? "1" : "0",
        });
        const d = await sr(token, "GET", `/courier/serviceability/?${qp}`);
        const list = d?.data?.available_courier_companies ?? [];
        return json({
          couriers: list.map((c: any) => ({
            courier_id: c.courier_company_id,
            name: c.courier_name,
            rate: c.rate,
            etd: c.etd,
            rating: c.rating,
          })),
        });
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
        if (!pickup?.shiprocket_pickup_name) {
          return json({ error: "Register a Shiprocket pickup location first (add pickup address and click 'Register with Shiprocket')" }, 400);
        }

        const payload = {
          order_id: `SB-${order.order_number ?? order.id.slice(0, 8)}`,
          order_date: new Date(order.created_at).toISOString().slice(0, 10),
          pickup_location: pickup.shiprocket_pickup_name,
          billing_customer_name: order.customer_name?.split(" ")[0] ?? "Customer",
          billing_last_name: order.customer_name?.split(" ").slice(1).join(" ") || " ",
          billing_address: order.street_address ?? "",
          billing_city: order.city ?? "",
          billing_pincode: order.pincode ?? "",
          billing_state: order.state ?? "",
          billing_country: "India",
          billing_email: (order as any).customer_email ?? "buyer@example.com",
          billing_phone: order.customer_phone ?? "",
          shipping_is_billing: true,
          order_items: (items ?? []).map((it: any) => ({
            name: it.product_name ?? "Item",
            sku: it.variant_sku ?? it.product_id?.slice(0, 12) ?? "SKU",
            units: it.quantity ?? 1,
            selling_price: Number(it.price ?? 0),
          })),
          payment_method: order.payment_method === "cod" ? "COD" : "Prepaid",
          sub_total: Number(order.total ?? 0),
          length: args.length_cm ?? 10,
          breadth: args.breadth_cm ?? 10,
          height: args.height_cm ?? 10,
          weight: args.weight_kg ?? 0.5,
        };
        const created = await sr(token, "POST", "/orders/create/adhoc", payload);
        let awb = null, courier = null, label = null;
        if (args.courier_id && created?.shipment_id) {
          const awbRes = await sr(token, "POST", "/courier/assign/awb", {
            shipment_id: created.shipment_id,
            courier_id: args.courier_id,
          });
          awb = awbRes?.response?.data?.awb_code ?? null;
          courier = awbRes?.response?.data?.courier_name ?? null;
          try {
            const lab = await sr(token, "POST", "/courier/generate/label", {
              shipment_id: [created.shipment_id],
            });
            label = lab?.label_url ?? null;
          } catch (_e) { /* label optional */ }
        }

        const { data: ship } = await svc.from("order_shipments").insert({
          order_id: args.order_id, store_id,
          provider: "shiprocket",
          provider_order_id: String(created.order_id ?? ""),
          provider_shipment_id: String(created.shipment_id ?? ""),
          courier_name: courier,
          awb, label_url: label,
          tracking_url: awb ? `https://shiprocket.co/tracking/${awb}` : null,
          status: awb ? "manifested" : "created",
          pickup_address_id: pickup.id,
          weight_grams: Math.round((args.weight_kg ?? 0.5) * 1000),
          length_cm: args.length_cm ?? 10,
          breadth_cm: args.breadth_cm ?? 10,
          height_cm: args.height_cm ?? 10,
          declared_value: Number(order.total ?? 0),
          cod_amount: order.payment_method === "cod" ? Number(order.total ?? 0) : 0,
          payment_mode: order.payment_method === "cod" ? "cod" : "prepaid",
          raw_payload: { created, awb },
        }).select().single();

        if (awb) {
          await svc.from("orders").update({
            tracking_number: awb,
            tracking_url: `https://shiprocket.co/tracking/${awb}`,
          }).eq("id", args.order_id);
        }
        return json({ shipment: ship });
      }

      case "track": {
        const awb = args.awb;
        if (!awb) return json({ error: "missing awb" }, 400);
        const d = await sr(token, "GET", `/courier/track/awb/${awb}`);
        return json({ tracking: d });
      }

      case "cancel": {
        const d = await sr(token, "POST", "/orders/cancel", {
          ids: [Number(args.provider_order_id)],
        });
        await svc.from("order_shipments").update({ status: "cancelled" })
          .eq("id", args.shipment_id);
        return json({ result: d });
      }

      case "label": {
        const d = await sr(token, "POST", "/courier/generate/label", {
          shipment_id: [Number(args.provider_shipment_id)],
        });
        return json({ label_url: d?.label_url ?? null, raw: d });
      }

      case "register_pickup": {
        const { data: pickup } = await svc.from("store_pickup_addresses")
          .select("*").eq("id", args.pickup_id).maybeSingle();
        if (!pickup) return json({ error: "pickup not found" }, 404);
        const nickname = args.nickname || pickup.nickname.slice(0, 8);
        const body = {
          pickup_location: nickname,
          name: pickup.contact_name, email: pickup.email ?? "warehouse@example.com",
          phone: pickup.phone, address: pickup.address_line1,
          address_2: pickup.address_line2 ?? "",
          city: pickup.city, state: pickup.state, country: "India",
          pin_code: pickup.pincode,
        };
        const d = await sr(token, "POST", "/settings/company/addpickup", body);
        await svc.from("store_pickup_addresses")
          .update({ shiprocket_pickup_name: nickname })
          .eq("id", args.pickup_id);
        return json({ result: d });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("shiprocket error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
