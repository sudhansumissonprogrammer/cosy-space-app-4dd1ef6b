// Delhivery direct integration.
// Actions: rate | serviceability | create | track | cancel

import {
  corsHeaders, json, authedUser, assertStoreOwner,
  loadProvider, serviceClient,
} from "../_shared/shipping.ts";

function base(sandbox: boolean) {
  return sandbox
    ? "https://staging-express.delhivery.com"
    : "https://track.delhivery.com";
}

async function dl(token: string, sandbox: boolean, method: string, path: string, body?: string, contentType = "application/json") {
  const r = await fetch(base(sandbox) + path, {
    method,
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/json",
      "Content-Type": contentType,
    },
    body,
  });
  const text = await r.text();
  let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`Delhivery ${method} ${path} [${r.status}]: ${text}`);
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
    const cfg = await loadProvider(store_id, "delhivery");
    const token = cfg.api_key!;
    const svc = serviceClient();

    switch (action) {
      case "serviceability": {
        const d = await dl(token, cfg.sandbox, "GET",
          `/c/api/pin-codes/json/?filter_codes=${args.pincode}`);
        const pc = d?.delivery_codes?.[0]?.postal_code;
        return json({
          serviceable: !!pc,
          cod: pc?.cod === "Y",
          prepaid: pc?.pre_paid === "Y",
          city: pc?.city, state: pc?.state_code,
        });
      }

      case "rate": {
        const qp = new URLSearchParams({
          md: "S",
          ss: "Delivered",
          d_pin: String(args.delivery_pincode),
          o_pin: String(args.pickup_pincode),
          cgm: String(args.weight_grams ?? 500),
          pt: args.cod ? "COD" : "Pre-paid",
        });
        const d = await dl(token, cfg.sandbox, "GET",
          `/api/kinko/v1/invoice/charges/.json?${qp}`);
        return json({ rate: d });
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

        const shipment = {
          name: order.customer_name ?? "Customer",
          add: order.street_address ?? "",
          pin: order.pincode ?? "",
          city: order.city ?? "",
          state: order.state ?? "",
          country: "India",
          phone: order.customer_phone ?? "",
          order: `SB-${order.order_number ?? order.id.slice(0, 8)}`,
          payment_mode: order.payment_method === "cod" ? "COD" : "Prepaid",
          return_pin: pickup.pincode, return_city: pickup.city,
          return_phone: pickup.phone, return_add: pickup.address_line1,
          return_state: pickup.state, return_country: "India",
          products_desc: (items ?? []).map((i: any) => i.product_name).join(", ").slice(0, 200),
          hsn_code: "",
          cod_amount: order.payment_method === "cod" ? String(order.total ?? 0) : "0",
          order_date: new Date(order.created_at).toISOString().slice(0, 19),
          total_amount: String(order.total ?? 0),
          seller_add: pickup.address_line1, seller_name: pickup.contact_name,
          seller_inv: "", quantity: String((items ?? []).reduce((s: number, i: any) => s + (i.quantity ?? 1), 0)),
          waybill: "", shipment_width: String(args.breadth_cm ?? 10),
          shipment_height: String(args.height_cm ?? 10),
          weight: String(args.weight_grams ?? 500),
          shipping_mode: args.mode ?? "Surface",
          address_type: "home",
        };
        const payload = { shipments: [shipment], pickup_location: { name: pickup.nickname } };
        const body = "format=json&data=" + encodeURIComponent(JSON.stringify(payload));
        const d = await dl(token, cfg.sandbox, "POST", "/api/cmu/create.json",
          body, "application/x-www-form-urlencoded");

        const pkg = d?.packages?.[0];
        const awb = pkg?.waybill;
        const { data: ship } = await svc.from("order_shipments").insert({
          order_id: args.order_id, store_id,
          provider: "delhivery",
          courier_name: "Delhivery",
          awb, provider_shipment_id: awb,
          tracking_url: awb ? `https://www.delhivery.com/track/package/${awb}` : null,
          label_url: awb ? `${base(cfg.sandbox)}/api/p/packing_slip?wbns=${awb}&pdf=true` : null,
          status: pkg?.status === "Success" ? "manifested" : "failed",
          last_error: pkg?.status === "Success" ? null : (pkg?.remarks?.join(", ") || null),
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
            tracking_url: `https://www.delhivery.com/track/package/${awb}`,
          }).eq("id", args.order_id);
        }
        return json({ shipment: ship });
      }

      case "track": {
        const r = await fetch(
          `https://track.delhivery.com/api/v1/packages/json/?waybill=${args.awb}`,
          { headers: { Authorization: `Token ${token}` } },
        );
        const d = await r.json();
        return json({ tracking: d });
      }

      case "cancel": {
        const body = "format=json&data=" + encodeURIComponent(JSON.stringify({
          waybill: args.awb, cancellation: "true",
        }));
        const d = await dl(token, cfg.sandbox, "POST", "/api/p/edit",
          body, "application/x-www-form-urlencoded");
        await svc.from("order_shipments").update({ status: "cancelled" }).eq("id", args.shipment_id);
        return json({ result: d });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("delhivery error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
