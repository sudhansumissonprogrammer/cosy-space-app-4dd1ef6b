import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

type CheckoutItem = {
  productId: string;
  variantId?: string | null;
  name: string;
  price: number;
  quantity: number;
};

const FBP_RX = /^fb\.[12]\.\d{10,16}\.\d+$/;
const FBC_RX = /^fb\.[12]\.\d{10,16}\.[A-Za-z0-9_-]+$/;
const META_EVENT_ID_RX = /^[A-Za-z0-9._:-]{8,120}$/;
const sanitizeFb = (v: unknown, rx: RegExp): string | null =>
  typeof v === "string" && v.length <= 256 && rx.test(v) ? v : null;
const sanitizeMetaEventId = (v: unknown): string | null =>
  typeof v === "string" && META_EVENT_ID_RX.test(v) ? v : null;

function runInBackground(task: Promise<unknown>, label: string): void {
  const guarded = task.catch((error) => {
    console.warn(`${label} background error`, error);
  });
  // Purchase tracking is best-effort and must never hold the shopper on the
  // COD spinner. The edge runtime keeps this promise alive after the response.
  // @ts-ignore — EdgeRuntime is provided by the edge-function Deno runtime.
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore — EdgeRuntime is provided by the edge-function Deno runtime.
    EdgeRuntime.waitUntil(guarded);
  }
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function hostAllowed(host: string, store: { slug?: string | null; custom_domain?: string | null }): boolean {
  const clean = normalizeHost(host);
  const customDomain = store.custom_domain ? normalizeHost(String(store.custom_domain)) : "";
  const slugHost = store.slug ? `${String(store.slug).toLowerCase()}.shopbanao.in` : "";
  return clean === customDomain || clean.endsWith(`.${customDomain}`) || clean === slugHost || clean === "shopbanao.in";
}

function sanitizeMetaSourceUrl(raw: unknown, store: { slug?: string | null; custom_domain?: string | null }): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (!hostAllowed(u.hostname, store)) return null;
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}
function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const v = ip.trim().toLowerCase();
  return /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/.test(v);
}

// BAN-FIX B3: reject obvious bot / scripted POSTs at the door. Fake COD
// orders posted with crafted fbp/fbc were firing real Purchase CAPI events
// (inflated conversions → Meta ad-quality flag). Bots almost never send a
// full browser UA string.
const BOT_UA_RX = /bot|crawler|spider|curl|wget|python-requests|Go-http-client|axios\/|node-fetch|HeadlessChrome|PhantomJS|Selenium|puppeteer/i;
function isBotUA(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 20) return true;
  return BOT_UA_RX.test(ua);
}

// PDP packaging add-ons (mirrors src/lib/packagingOptions.ts). Server is the
// single source of truth for the surcharge amount.
const PACKAGING_SURCHARGE: Record<string, number> = { complimentary: 0, signature: 200, brandkit: 400 };
const PACKAGING_LABEL: Record<string, string> = {
  signature: "Utkal Signature Box",
  brandkit: "OG Brand Kit",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const reqUa = req.headers.get("user-agent") || "";
    if (isBotUA(reqUa)) {
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let {
      store_id,
      order,
      items,
      lead,
      coupon_id,
      abandoned_cart_id,
      checkout_token,
      meta,
      visitor_id,
      session_id,
      attribution,
      user_initiated,
    }: {
      store_id: string;
      order: {
        total: number;
        currency: string;
        status: string;
        customer_name: string;
        customer_phone: string;
        street_address: string;
        city: string;
        state: string;
        pincode: string;
        payment_method: "cod" | "razorpay" | "cashfree" | "payu";
        notes?: string;
        storefront_customer_id?: string | null;
        payment_type?: "full" | "partial";
      };
      items: CheckoutItem[];
      lead?: {
        name: string;
        phone: string;
        product_name: string;
        product_id: string | null;
        source: string;
      };
      coupon_id?: string | null;
      abandoned_cart_id?: string | null;
      checkout_token?: string | null;
      // Meta tracking signals captured from the browser. Used for safe CAPI Purchase reporting.
      meta?: {
        event_id?: string;
        fbc?: string;
        fbp?: string;
        event_source_url?: string;
        // Advanced Matching: stable anon/customer visitor ID (sf_vid) + email
        // typed at checkout. Stored on the order so the server Purchase CAPI
        // sends the SAME external_id / em hash the browser pixel already sent.
        external_id?: string;
        email?: string;
      };
      // Strict analytics: link this order back to the visitor session that
      // produced it so conversion rate = orders / unique sessions is accurate.
      visitor_id?: string | null;
      session_id?: string | null;
      // Attribution snapshot: last-touch UTM + ad-click IDs (fbclid/gclid/...)
      // sent by the browser so we can tie revenue back to campaigns and ads.
      attribution?: Record<string, string | null> | null;
      // True only when the shopper explicitly tapped Pay / Place order. Automatic
      // client re-mints send false, which lets us reject stale post-payment
      // retries that would otherwise create a duplicate pending order.
      user_initiated?: boolean;
    } = await req.json();



    if (!store_id || !order || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ────────────────────────────────────────────────────────────────
    // BUNDLE EXPANSION — resolve any `meta.kind === "bundle"` line into
    // its real child products at server-authoritative combo prices.
    // The client sends one synthetic "bundle:<uuid>" line so cart UX stays
    // simple; the server rewrites it into N child order_items whose per-unit
    // prices sum to the configured combo total. `__bundle_priced` tells the
    // canonical-price loop below to skip its DB-price override for that row.
    // ────────────────────────────────────────────────────────────────
    try {
      const bundleLines = (items || []).filter((it: any) =>
        it && it.meta && it.meta.kind === "bundle" && Array.isArray(it.meta.children) && it.meta.children.length > 0,
      );
      if (bundleLines.length > 0) {
        const { data: appRow } = await supabase
          .from("store_apps")
          .select("config")
          .eq("store_id", store_id)
          .eq("app_id", "bundle-builder")
          .maybeSingle();
        const bundles: any[] = (appRow?.config as any)?.bundles || [];
        const bundlesById = new Map<string, any>(bundles.map((b: any) => [String(b.id), b]));
        const childIds = Array.from(new Set(bundleLines.flatMap((bl: any) =>
          bl.meta.children.map((c: any) => String(c.productId)).filter(Boolean),
        )));
        const childPriceById = new Map<string, number>();
        const childNameById = new Map<string, string>();
        if (childIds.length > 0) {
          const { data: childProds } = await supabase
            .from("products")
            .select("id, name, price, sale_price, is_active, store_id")
            .in("id", childIds);
          for (const p of (childProds || [])) {
            if (p.store_id !== store_id || !p.is_active) continue;
            const cp = p.sale_price != null ? Number(p.sale_price) : Number(p.price);
            if (cp >= 0) {
              childPriceById.set(String(p.id), cp);
              childNameById.set(String(p.id), p.name);
            }
          }
        }
        const expanded: any[] = [];
        for (const it of items as any[]) {
          const bl = it && it.meta && it.meta.kind === "bundle" ? it : null;
          if (!bl) { expanded.push(it); continue; }
          const bDef = bundlesById.get(String(bl.meta.bundle_id));
          if (!bDef || bDef.is_active === false) {
            return new Response(
              JSON.stringify({ error: "Bundle no longer available. Please rebuild your combo." }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          const rawChildren = (bl.meta.children as any[])
            .map((c: any) => ({ productId: String(c.productId) }))
            .filter((c) => childPriceById.has(c.productId));
          if (rawChildren.length !== bl.meta.children.length) {
            return new Response(
              JSON.stringify({ error: "One or more bundle products are unavailable" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          const toPaise = (n: any) => Math.max(0, Math.round(Number(n || 0) * 100));
          const mrpPaise = rawChildren.reduce((s, c) => s + toPaise(childPriceById.get(c.productId)), 0);
          const mode = bDef.discount_mode || "flat";
          const type = bDef.type || "pick_n";
          let totalPaise = 0;
          if (type === "fbt" || type === "fixed") {
            if (mode === "percent_off") {
              const pct = Math.max(0, Math.min(99, Number(bDef.discount_percent || 0)));
              totalPaise = Math.round(mrpPaise * (1 - pct / 100));
            } else if (mode === "amount_off") {
              totalPaise = Math.max(0, mrpPaise - toPaise(bDef.discount_amount));
            } else {
              totalPaise = toPaise(bDef.bundle_price);
            }
          } else {
            totalPaise = toPaise(bDef.bundle_price);
          }
          const N = Math.max(1, rawChildren.length);
          const base = Math.floor(totalPaise / N);
          const remainder = totalPaise - base * N;
          const qty = Math.max(1, Math.floor(Number(bl.quantity) || 1));
          for (let i = 0; i < rawChildren.length; i++) {
            const finalPaise = base + (i === N - 1 ? remainder : 0);
            expanded.push({
              productId: rawChildren[i].productId,
              variantId: null,
              name: childNameById.get(rawChildren[i].productId) || "Combo item",
              price: finalPaise / 100,
              quantity: qty,
              meta: { __bundle_priced: true, parent_bundle_id: bDef.id, bundle_slug: bDef.slug },
            });
          }
        }
        items = expanded;
      }
    } catch (e) {
      console.error("bundle expansion failed:", e);
      return new Response(
        JSON.stringify({ error: "Failed to price bundle. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ────────────────────────────────────────────────────────────────
    // UPSELL EXPANSION — for lines with meta.kind === "upsell", look up
    // the offer and re-derive the incentive price server-side.
    // ────────────────────────────────────────────────────────────────
    try {
      const upsellLines = (items || []).filter((it: any) => it?.meta?.kind === "upsell");
      if (upsellLines.length > 0) {
        const { data: uRow } = await supabase
          .from("store_apps")
          .select("config, enabled")
          .eq("store_id", store_id)
          .eq("app_id", "upsell-crosssell")
          .maybeSingle();
        const enabledUpsell = !!uRow?.enabled;
        const offers: any[] = (uRow?.config as any)?.offers || [];
        const offerById = new Map<string, any>(offers.map((o: any) => [String(o.id), o]));
        const upsellIds = Array.from(new Set(upsellLines.map((it: any) => String(it.productId)).filter(Boolean)));
        const upsellPriceById = new Map<string, { price: number; sale: number | null }>();
        if (upsellIds.length > 0) {
          const { data: uProds } = await supabase
            .from("products")
            .select("id, price, sale_price, is_active, store_id")
            .in("id", upsellIds);
          for (const p of (uProds || [])) {
            if (p.store_id !== store_id || !p.is_active) continue;
            upsellPriceById.set(String(p.id), {
              price: Number(p.price) || 0,
              sale: p.sale_price != null ? Number(p.sale_price) : null,
            });
          }
        }
        for (const it of items as any[]) {
          if (it?.meta?.kind !== "upsell") continue;
          const offer = enabledUpsell ? offerById.get(String(it.meta.offer_id)) : null;
          const p = upsellPriceById.get(String(it.productId));
          if (!p) continue;
          const base = p.sale != null && p.sale < p.price ? p.sale : p.price;
          let finalPrice = base;
          const inc = offer?.incentive;
          if (offer && offer.active !== false && inc && inc.type && inc.type !== "none") {
            if (inc.type === "percent_off") {
              const v = Math.max(0, Math.min(100, Number(inc.value) || 0));
              finalPrice = Math.max(0, Math.round(base * (100 - v)) / 100);
            } else if (inc.type === "flat_off") {
              finalPrice = Math.max(0, base - (Number(inc.value) || 0));
            } else if (inc.type === "free_gift") {
              finalPrice = 0;
            }
          }
          it.price = finalPrice;
          (it as any).__upsell_priced = true;
        }
      }
    } catch (e) {
      console.error("upsell expansion failed:", e);
    }

    // Persistent cross-isolate rate limit, scoped to the shopper identity
    // instead of raw IP. Mobile carriers/Instagram often put many real buyers
    // behind one NAT IP; IP-only limits caused unrelated shoppers to get 429s.
    // Still blocks checkout loops because the same browser posts the same phone
    // (or, before phone is present, the same checkout_token/session) repeatedly.
    // Idempotency: checkout_token represents ONE shopper checkout attempt.
    // If the row is still mutable (pending/cancelled/failed), continue through
    // price recomputation and UPDATE that same row. If it is already paid/COD
    // confirmed, return it unchanged. This prevents payment-plan toggles from
    // creating multiple pending orders for the same phone/session.
    let reusableOrder: {
      id: string;
      order_number: number | null;
      status: string | null;
      applied_coupon_id: string | null;
      customer_name?: string | null;
      street_address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
    } | null = null;
    if (checkout_token) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, order_number, status, applied_coupon_id, payment_verified, created_at, customer_name, street_address, city, state, pincode")
        .eq("store_id", store_id)
        .eq("checkout_token", checkout_token)
        .maybeSingle();


      if (existingOrder) {
        // A cancelled/failed row can still be payment_verified (customer paid,
        // then cancelled). Rewriting that row into a fresh pending attempt
        // would carry `payment_verified = true` onto an unpaid order.
        const reusableStatuses = new Set(["pending", "cancelled", "failed"]);
        // AGE GUARD — checkout_token lives in localStorage, so a shopper who
        // abandons today and returns tomorrow posts the SAME token. Rewriting
        // that old row would keep yesterday's created_at and the paid order
        // would silently appear in yesterday's list (already-packed day).
        // Anything older than 2 hours is a different shopping visit: tell the
        // client to rotate the token so a brand-new order is created today.
        const createdMs = new Date(String((existingOrder as any).created_at || 0)).getTime();
        const isStaleAttempt = Number.isFinite(createdMs) && Date.now() - createdMs > 2 * 60 * 60 * 1000;
        if (reusableStatuses.has(String(existingOrder.status || "")) && !existingOrder.payment_verified && isStaleAttempt) {
          return new Response(JSON.stringify({ success: true, token_stale: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (reusableStatuses.has(String(existingOrder.status || "")) && !existingOrder.payment_verified) {
          reusableOrder = existingOrder as typeof reusableOrder;
        } else {

        const orderNumber = existingOrder.order_number
          ? `#${1000 + existingOrder.order_number}`
          : `#${existingOrder.id.slice(0, 8).toUpperCase()}`;
        // `token_consumed` tells the storefront this idempotency key already
        // belongs to a paid/confirmed order. The client rotates to a fresh
        // token and retries ONCE so a second, genuinely new order can be
        // placed in the same tab instead of dead-ending on already_paid.
        return new Response(JSON.stringify({ success: true, order_id: existingOrder.id, order_number: orderNumber, profit: null, token_consumed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
        }
      }
    }


    try {
      const phoneDigits = String(order?.customer_phone || "").replace(/\D/g, "").slice(-10);
      const identity = phoneDigits || checkout_token || session_id || visitor_id || clientIp;
      // Updates to an order the shopper is ALREADY on are not abuse: reloading
      // the checkout page, toggling Partial<->Full, editing the address or
      // changing quantity all re-post here against the same checkout_token.
      // Capping those at 8/10min dead-ended real buyers with "UPI apps
      // unavailable" and no way to pay. Only brand-new order creation keeps
      // the tight cap.
      const isUpdate = !!reusableOrder;
      const { data: limited } = await supabase.rpc("hit_rate_limit", {
        _key: `order_rl:${store_id}:${identity}${isUpdate ? ":upd" : ""}`,
        _max: isUpdate ? 60 : 8,
        _window_seconds: 600,
      });
      if (limited === true) {
        return new Response(JSON.stringify({ error: "Too many attempts. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch { /* fail-open */ }

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, is_suspended, default_profit_margin, slug, custom_domain, partial_payment_enabled, partial_payment_value")
      .eq("id", store_id)
      .single();

    if (storeErr || !store || store.is_suspended) {
      return new Response(JSON.stringify({ error: "Store is not accepting orders" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A store with partial payment enabled requires its configured online
    // advance. `cod` remains a delivery method for the balance, not a separate
    // zero-advance checkout option. Enforce this server-side so old cached
    // storefront bundles and direct function calls cannot create full COD.
    if (
      order.payment_method === "cod" &&
      store.partial_payment_enabled &&
      Number(store.partial_payment_value || 0) > 0
    ) {
      return new Response(JSON.stringify({ error: "Advance payment is required for this store" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve storefront_customer_id from the *entered phone*, not from a
    // stale localStorage session. Attackers/testers who typed a different
    // phone earlier would otherwise attach the new order to the wrong
    // customer, hiding it from that shopper's "My Orders" list.
    let storefrontCustomerId: string | null = null;
    const enteredPhoneDigits = String(order.customer_phone || "").replace(/\D/g, "");
    const enteredPhone10 = enteredPhoneDigits.length >= 10 ? enteredPhoneDigits.slice(-10) : enteredPhoneDigits;

    if (order.storefront_customer_id) {
      const { data: customer } = await supabase
        .from("storefront_customers")
        .select("id, phone")
        .eq("id", order.storefront_customer_id)
        .eq("store_id", store_id)
        .maybeSingle();

      if (customer?.id) {
        const cPhone = String((customer as any).phone || "").replace(/\D/g, "").slice(-10);
        // Only trust the client-supplied id when its phone matches the
        // phone actually being used to place this order.
        if (cPhone && enteredPhone10 && cPhone === enteredPhone10) {
          storefrontCustomerId = customer.id;
        }
      }
    }

    // Fallback / correction: look up by (store_id, entered phone) so the
    // order always attaches to the correct shopper record.
    if (!storefrontCustomerId && enteredPhone10) {
      const { data: byPhone } = await supabase
        .from("storefront_customers")
        .select("id")
        .eq("store_id", store_id)
        .eq("phone", enteredPhone10)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if ((byPhone as any)?.id) storefrontCustomerId = (byPhone as any).id;
    }

    // ────────────────────────────────────────────────────────────────
    // SECURITY: server-side price + total recomputation.
    // Never trust client-supplied prices, totals, discounts, or status.
    // Attackers can otherwise place a ₹10,000 order at ₹1.
    // ────────────────────────────────────────────────────────────────
    const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    if (productIds.length === 0 || items.some((i) => !i.productId)) {
      return new Response(JSON.stringify({ error: "Invalid cart items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: dbProducts, error: prodErr } = await supabase
      .from("products")
      .select("id, price, sale_price, is_active, store_id, image_url, stock_quantity")
      .in("id", productIds);
    if (prodErr || !dbProducts || dbProducts.length !== productIds.length) {
      return new Response(JSON.stringify({ error: "One or more products not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const productById = new Map<string, any>();
    const canonicalPrice = new Map<string, number>();
    const canonicalImage = new Map<string, string | null>();
    for (const p of dbProducts) {
      if (p.store_id !== store_id || !p.is_active) {
        return new Response(JSON.stringify({ error: "Product unavailable" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      productById.set(p.id, p);
      const cp = p.sale_price != null ? Number(p.sale_price) : Number(p.price);
      if (!(cp >= 0)) {
        return new Response(JSON.stringify({ error: "Invalid product price" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      canonicalPrice.set(p.id, cp);
      canonicalImage.set(p.id, (p as any).image_url ?? null);
    }
    const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean))] as string[];
    const variantById = new Map<string, any>();
    if (variantIds.length > 0) {
      const { data: dbVariants, error: variantErr } = await supabase
        .from("product_variants")
        .select("id, product_id, name, price, is_active, stock_quantity")
        .in("id", variantIds);
      if (variantErr || !dbVariants || dbVariants.length !== variantIds.length) {
        return new Response(JSON.stringify({ error: "One or more variants not found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const v of dbVariants) {
        if (!v.is_active || !productById.has(v.product_id)) {
          return new Response(JSON.stringify({ error: "Variant unavailable" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        variantById.set(v.id, v);
      }
    }

    // ── Stock guard: aggregate requested qty per product / variant and reject
    // any line that exceeds available stock. stock_quantity IS NULL means
    // "untracked" and stays purchasable; 0 or below means sold out. This is
    // the last line of defence — the storefront also hides sold-out CTAs, but
    // direct-URL checkout attempts have to be blocked here.
    const requestedByProduct = new Map<string, number>();
    const requestedByVariant = new Map<string, number>();
    for (const it of items) {
      const q = Math.max(1, Math.floor(Number(it.quantity) || 0));
      if (it.variantId) {
        requestedByVariant.set(it.variantId, (requestedByVariant.get(it.variantId) || 0) + q);
      } else {
        requestedByProduct.set(it.productId, (requestedByProduct.get(it.productId) || 0) + q);
      }
    }
    for (const [pid, want] of requestedByProduct) {
      const p = productById.get(pid);
      const stock = p?.stock_quantity;
      if (stock != null && Number(stock) < want) {
        return new Response(
          JSON.stringify({ error: "Out of stock", detail: `Product ${p?.id} has ${stock} left, ${want} requested` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    for (const [vid, want] of requestedByVariant) {
      const v = variantById.get(vid);
      const stock = v?.stock_quantity;
      if (stock != null && Number(stock) < want) {
        return new Response(
          JSON.stringify({ error: "Out of stock", detail: `Variant ${v?.id} has ${stock} left, ${want} requested` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    // Override every line-item price with the DB canonical price.
    // Bundle-expanded rows carry `__bundle_priced` — keep their per-unit price
    // (which sums to the configured combo total) instead of resetting to MRP.
    // Upsell rows carry `__upsell_priced` — same rationale (incentive already applied).
    let serverSubtotal = 0;
    for (const item of items) {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 0));
      if ((item as any).meta?.__bundle_priced || (item as any).__upsell_priced) {
        const cp = Math.max(0, Number(item.price) || 0);
        item.price = cp;
        item.quantity = qty;
        serverSubtotal += cp * qty;
        continue;
      }
      const variant = item.variantId ? variantById.get(item.variantId) : null;
      if (variant && variant.product_id !== item.productId) {
        return new Response(JSON.stringify({ error: "Variant/product mismatch" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const variantPrice = variant?.price != null ? Number(variant.price) : null;
      let cp = variantPrice != null && variantPrice >= 0 ? variantPrice : canonicalPrice.get(item.productId)!;
      // Packaging upgrade add-on: the client only sends the option key, the
      // surcharge is re-derived here so the price can't be tampered with.
      const pkgKey = String((item as any).meta?.packaging || "");
      const pkgSurcharge = PACKAGING_SURCHARGE[pkgKey] ?? 0;
      if (pkgSurcharge > 0) {
        cp += pkgSurcharge;
        (item as any).meta = { ...((item as any).meta || {}), packaging: pkgKey, packaging_surcharge: pkgSurcharge };
        const label = PACKAGING_LABEL[pkgKey];
        if (label && !String(item.name || "").includes(label)) item.name = `${item.name} + ${label}`;
      }
      item.price = cp;
      item.quantity = qty;
      serverSubtotal += cp * qty;
    }

    // Validate coupon server-side. If client sent no coupon_id, fall back to the
    // store's auto-apply coupon so the discount is honored even when the client
    // skipped the fetch (stale cache, offline mint, etc).
    let serverDiscount = 0;
    let validCouponId: string | null = null;
    let couponIdToCheck: string | null = coupon_id ?? null;
    if (!couponIdToCheck) {
      // NOTE: a store can have TWO active auto-apply coupons (store-wide +
      // WhatsApp-exclusive). `.maybeSingle()` without the wa_exclusive filter
      // errored on multiple rows and silently dropped the discount, which is
      // why auto-apply coupons were missing on some orders. Pick the store-wide
      // one explicitly.
      const { data: autoRows } = await supabase
        .from("coupons")
        .select("id")
        .eq("store_id", store_id)
        .eq("is_active", true)
        .eq("auto_apply", true)
        .eq("wa_exclusive", false)
        .limit(1);
      const autoRow = Array.isArray(autoRows) ? autoRows[0] : null;
      if (autoRow?.id) couponIdToCheck = autoRow.id;
    }

    // Resolve the best valid coupon. If the client-supplied coupon fails
    // validation (stale cache, expired WA-exclusive, max_uses hit), fall back
    // to the store's auto-apply coupon rather than silently charging full
    // price — the shopper was shown a discounted total on the PDP/checkout.
    const evaluateCoupon = async (id: string) => {
      const { data: c } = await supabase
        .from("coupons")
        .select("id, store_id, discount_type, discount_value, min_order_amount, max_uses, used_count, is_active, starts_at, expires_at")
        .eq("id", id)
        .maybeSingle();
      const nowD = new Date();
      const ok = c
        && c.store_id === store_id
        && c.is_active
        && (!c.starts_at || new Date(c.starts_at) <= nowD)
        && (!c.expires_at || new Date(c.expires_at) > nowD)
        && (c.max_uses == null || (c.used_count ?? 0) < c.max_uses)
        && serverSubtotal >= Number(c.min_order_amount || 0);
      if (!ok || !c) return null;
      let d = c.discount_type === "percentage"
        ? serverSubtotal * (Number(c.discount_value) / 100)
        : Number(c.discount_value);
      d = Math.max(0, Math.min(d, serverSubtotal));
      return { id: c.id, discount: d };
    };

    const candidates: string[] = [];
    if (couponIdToCheck) candidates.push(couponIdToCheck);
    if (coupon_id) {
      // Client coupon failed? Try the store-wide auto-apply coupon next.
      const { data: fbRows } = await supabase
        .from("coupons")
        .select("id")
        .eq("store_id", store_id)
        .eq("is_active", true)
        .eq("auto_apply", true)
        .eq("wa_exclusive", false)
        .limit(1);
      const fbId = Array.isArray(fbRows) ? fbRows[0]?.id : null;
      if (fbId && !candidates.includes(fbId)) candidates.push(fbId);
    }

    for (const cid of candidates) {
      const res = await evaluateCoupon(cid);
      if (res) {
        serverDiscount = res.discount;
        validCouponId = res.id;
        break;
      }
    }


    // Validate shipping server-side.
    let serverShipping = 0;
    const { data: shipConf } = await supabase
      .from("store_shipping_config")
      .select("flat_rate, free_shipping_above, is_active")
      .eq("store_id", store_id)
      .maybeSingle();
    if (shipConf?.is_active) {
      const subtotalAfterDiscount = serverSubtotal - serverDiscount;
      if (!shipConf.free_shipping_above || subtotalAfterDiscount < Number(shipConf.free_shipping_above)) {
        serverShipping = Math.max(0, Number(shipConf.flat_rate) || 0);
      }
    }

    // Validate tax server-side; mirrors CheckoutV2. Inclusive tax is already in
    // item prices, while exclusive tax is added to the payable amount.
    let serverTax = 0;
    const { data: taxConf } = await supabase
      .from("store_tax_config")
      .select("tax_rate, is_active, is_inclusive")
      .eq("store_id", store_id)
      .maybeSingle();
    if (taxConf?.is_active && Number(taxConf.tax_rate) > 0) {
      const rate = Number(taxConf.tax_rate);
      serverTax = taxConf.is_inclusive
        ? serverSubtotal - (serverSubtotal / (1 + rate / 100))
        : (serverSubtotal * rate) / 100;
    }
    const serverTaxToAdd = taxConf?.is_inclusive ? 0 : serverTax;

    // C5: Atomically claim the coupon BEFORE creating the order.
    // Prevents two concurrent checkouts from both consuming the last allowed
    // use. For a reusable pending order, only claim when the coupon actually
    // changes (e.g. first mint had no coupon, remint now applies auto-apply).
    // Skipping the claim unconditionally on remint let auto-apply coupons
    // silently exceed their max_uses cap.
    const alreadyClaimedForThisOrder = reusableOrder?.applied_coupon_id === validCouponId;
    if (validCouponId && !alreadyClaimedForThisOrder) {
      const { data: claimed, error: claimErr } = await supabase
        .rpc("claim_coupon", { _coupon_id: validCouponId, _store_id: store_id });
      if (claimErr || claimed !== true) {
        return new Response(
          JSON.stringify({ error: "Coupon no longer available. Please remove it and try again." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Prepaid discount (store-configured) — applies ONLY on full online payment.
    // Never on COD, never on partial. Recomputed server-side so client cannot
    // trick the total by pretending to pay online. Stored in `notes` line so
    // owners see why the collected amount differs from the item subtotal.
    let prepaidDiscount = 0;
    const isFullOnline =
      order.payment_type !== "partial" &&
      order.payment_method !== "cod";
    if (isFullOnline) {
      const { data: payCfg } = await supabase
        .from("store_payment_config")
        .select("prepaid_discount_enabled, prepaid_discount_type, prepaid_discount_value, prepaid_discount_tier2_min, prepaid_discount_tier2_value")
        .eq("store_id", store_id)
        .maybeSingle();
      if (payCfg?.prepaid_discount_enabled) {
        const baseVal = Number(payCfg.prepaid_discount_value || 0);
        const base = Math.max(0, serverSubtotal - serverDiscount + serverShipping + serverTaxToAdd);
        // Skip prepaid discount on sub-₹100 carts so a ₹5 item doesn't
        // collapse to ₹0 when a fixed ₹100 discount is configured.
        if (base >= 100) {
          // Tier-2 kicks in for FIXED discounts when the order value crosses the threshold.
          const t2Min = Number(payCfg.prepaid_discount_tier2_min || 0);
          const t2Val = Number(payCfg.prepaid_discount_tier2_value || 0);
          const useTier2 = payCfg.prepaid_discount_type !== "percentage" && t2Min > 0 && t2Val > 0 && base >= t2Min;
          const flatVal = useTier2 ? t2Val : baseVal;
          let d = payCfg.prepaid_discount_type === "percentage"
            ? (base * baseVal) / 100
            : flatVal;
          prepaidDiscount = Math.max(0, Math.min(d, base));
        }
      }

    }


    const serverTotal = Math.max(
      0,
      Math.round((serverSubtotal - serverDiscount + serverShipping + serverTaxToAdd - prepaidDiscount) * 100) / 100,
    );
    // Replace client-supplied total + coupon_id with server-verified values.
    order.total = serverTotal;
    coupon_id = validCouponId;
    // Always rebuild the notes field from scratch. On a remint (shopper
    // switches full → partial on an existing pending order) the old
    // "Prepaid discount" line would otherwise stick around on a partial
    // order — and if `notes` was undefined the UPDATE dropped the key
    // entirely, leaving the stale line in the DB. Strip + re-add.
    const baseNotes = String(order.notes ?? "")
      .split("\n")
      .filter((l) => !/^\s*Prepaid discount:/i.test(l))
      .join("\n")
      .trim();
    order.notes = baseNotes || null;
    if (prepaidDiscount > 0) {
      const note = `Prepaid discount: -${prepaidDiscount.toFixed(2)}`;
      order.notes = order.notes ? `${order.notes}\n${note}` : note;
    }


    // ────────────────────────────────────────────────────────────────
    // Server-side partial payment calculation (store-level).
    // Must be the SINGLE source of truth — UI value is advisory only.
    // Formula mirrors CheckoutV2Page: sum per-item advance, add full shipping
    // + proportional tax/discount adjustment, single ₹50 floor,
    // cap at order total. Never applies a per-line-item ₹50 floor.
    // ────────────────────────────────────────────────────────────────
    let isPartial = order.payment_type === "partial";
    let advancePaid = 0;
    let balanceDue = 0;

    if (isPartial) {
      // Partial requires an online gateway — reject partial+cod combo.
      if (order.payment_method === "cod") {
        return new Response(
          JSON.stringify({ error: "Partial payment requires an online payment method." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: storeData } = await supabase
        .from("stores")
        .select("partial_payment_enabled, partial_payment_type, partial_payment_value")
        .eq("id", store_id)
        .single();

      const partialValue = Number(storeData?.partial_payment_value || 0);
      if (storeData?.partial_payment_enabled && partialValue > 0) {
        // Advance is charged PER PRODUCT UNIT as the store configured it.
        let itemsAdvance = 0;
        for (const item of items) {
          const itemPrice = Number(item.price);
          const itemAdv = storeData.partial_payment_type === "percentage"
            ? Math.round(itemPrice * (partialValue / 100))
            : Math.min(partialValue, itemPrice);
          itemsAdvance += itemAdv * Number(item.quantity);
        }


        // Advance = configured up-front amount (per-item) + full shipping,
        // capped at order total. Coupons reduce the BALANCE (paid on
        // delivery), never the advance — otherwise a ₹100 coupon on a
        // ₹100 advance would drop it to ~₹69. Tax adjusts proportionally.
        const ratio = serverSubtotal > 0 ? itemsAdvance / serverSubtotal : 1;
        const raw = itemsAdvance + (serverTaxToAdd * ratio) + serverShipping;
        // Clamp to the order total LAST — applying the ₹50 floor after the cap
        // charged ₹50 advance on a ₹5 order (advance > total, balance ₹0).
        advancePaid = Math.min(Number(order.total), Math.max(50, Math.round(raw)));

        balanceDue = Math.max(0, Number(order.total) - advancePaid);
      } else {
        // Store doesn't actually offer partial — downgrade to full instead of
        // silently stamping payment_type=partial with advance_paid=0.
        isPartial = false;
        order.payment_type = "full";
      }
    }

    // Hardcode initial order status. Never trust the client.
    // COD → confirmed. Online (full or partial) → pending until verify upgrades it.
    const safeStatus = order.payment_method === "cod" ? "confirmed" : "pending";
    order.status = safeStatus;

    // Capture real buyer signals for Meta CAPI (forwarded by Cloudflare/Vercel/SB edge).
    // We store these on the order row so the Purchase event sent to Meta carries the
    // visitor's real IP + UA — never the edge runtime's datacenter IP.
    const rawBuyerIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const buyerIp = isPrivateIp(rawBuyerIp) ? null : rawBuyerIp;
    const buyerUa = req.headers.get("user-agent") || null;
    let buyerFbc = sanitizeFb(meta?.fbc, FBC_RX);
    let buyerFbp = sanitizeFb(meta?.fbp, FBP_RX);
    const metaEventId = sanitizeMetaEventId(meta?.event_id);
    // Advanced Matching signals — opaque, length-capped, never trusted as auth.
    const buyerExternalId =
      typeof meta?.external_id === "string" && /^[A-Za-z0-9._:-]{6,128}$/.test(meta.external_id.trim())
        ? meta.external_id.trim()
        : null;
    const rawBuyerEmail = typeof meta?.email === "string" ? meta.email.trim().toLowerCase() : "";
    const buyerEmail =
      rawBuyerEmail.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawBuyerEmail)
        ? rawBuyerEmail
        : null;
    const metaEventSourceUrl = sanitizeMetaSourceUrl(meta?.event_source_url, store);

    // BAN-FIX B3: for COD orders, only trust client-supplied fbc/fbp when the
    // request ALSO carries a browser-generated event_id. Real storefront
    // checkouts always attach one (InitiateCheckout mints it); scripted
    // "fake COD Purchase" POSTs almost never bother. Stripping the tokens
    // here means firePurchaseCapi's `isStorefrontOrder` gate rejects the fake
    // order → no polluted Purchase CAPI → no inflated conversions/EMQ dip.
    if (order.payment_method === "cod" && !metaEventId) {
      buyerFbc = null;
      buyerFbp = null;
    }

    // BAN-FIX B4: extra per-phone COD throttle — 3 confirmed COD orders per
    // hour per normalized phone number. Same phone spamming COD orders is
    // the classic fake-conversion signal Meta watches for.
    // Count only a genuinely new COD order. Checkout retries/address updates
    // reuse the same pending row and must not consume additional quota; doing
    // so locked legitimate shoppers after one order plus a few UI retries.
    if (order.payment_method === "cod" && !reusableOrder) {
      try {
        const normPhoneForRl = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);
        if (normPhoneForRl.length >= 10) {
          const { data: codLimited } = await supabase.rpc("hit_rate_limit", {
            _key: `cod_phone:${store_id}:${normPhoneForRl}`,
            _max: 3,
            _window_seconds: 3600,
          });
          if (codLimited === true) {
            return new Response(
              JSON.stringify({ error: "Too many COD orders from this phone. Please try again later." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      } catch { /* fail-open */ }
    }

    // Compute new-vs-repeat: count prior PAID orders in this store for the
    // same storefront customer id (preferred) or the same normalized phone.
    // Used by the dashboard for LTV / repeat-rate slicing.
    let priorOrderCount = 0;
    try {
      const PAID = ["paid", "confirmed", "partially_paid", "delivered", "completed", "shipped"];
      const normPhone = String(order.customer_phone || "").replace(/\D/g, "");
      let q = supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store_id)
        .in("status", PAID);
      if (storefrontCustomerId) {
        q = q.eq("storefront_customer_id", storefrontCustomerId);
      } else if (normPhone) {
        q = q.eq("customer_phone", order.customer_phone);
      } else {
        q = q.eq("id", "00000000-0000-0000-0000-000000000000");
      }
      const { count } = await q;
      priorOrderCount = count || 0;
    } catch { /* non-fatal */ }

    // Sanitize attribution snapshot — only keep known keys, cap length.
    const ATTR_KEYS = new Set([
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "ttclid", "wbraid", "gbraid", "msclkid",
      "referrer", "landing_path",
    ]);
    let attributionClean: Record<string, string> | null = null;
    if (attribution && typeof attribution === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(attribution)) {
        if (ATTR_KEYS.has(k) && typeof v === "string" && v) {
          out[k] = v.slice(0, 200);
        }
      }
      if (Object.keys(out).length) attributionClean = out;
    }

    // SHIPPING IDENTITY GUARD.
    // In-app browsers (Instagram / WhatsApp webviews) sometimes recreate the
    // checkout tab and wipe React state, so a re-mint can post an EMPTY name /
    // address while the shopper is mid-payment. Writing those blanks produced
    // paid orders with no delivery address. Never blank out values we already
    // hold on the same checkout_token row, and refuse to create a brand-new
    // order without a usable address.
    const keep = (incoming: unknown, existing: unknown): string => {
      const inc = String(incoming ?? "").trim();
      if (inc) return inc;
      return String(existing ?? "").trim();
    };
    const shipName = keep(order.customer_name, reusableOrder?.customer_name);
    const shipStreet = keep(order.street_address, reusableOrder?.street_address);
    const shipCity = keep(order.city, reusableOrder?.city);
    const shipState = keep(order.state, reusableOrder?.state);
    const shipPincode = keep(order.pincode, reusableOrder?.pincode);
    if (!shipName || !shipStreet || !/^\d{6}$/.test(shipPincode.replace(/\D/g, ""))) {
      return new Response(
        JSON.stringify({ error: "Delivery address is missing — please re-enter your address." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const orderPayload = {
        store_id,
        total: Number(order.total),
        currency: order.currency,
        status: order.status,
        customer_name: shipName,
        customer_phone: order.customer_phone,
        street_address: shipStreet,
        city: shipCity,
        state: shipState,
        pincode: shipPincode,

        payment_method: order.payment_method,
        notes: order.notes,
        storefront_customer_id: storefrontCustomerId,
        payment_type: isPartial ? "partial" : "full",
        advance_paid: advancePaid,
        balance_due: balanceDue,
        checkout_token: checkout_token || null,
        buyer_ip: buyerIp,
        buyer_user_agent: buyerUa,
        buyer_fbc: buyerFbc,
        buyer_fbp: buyerFbp,
        buyer_external_id: buyerExternalId,
        buyer_email: buyerEmail,
        meta_event_id: metaEventId,
        meta_event_source_url: metaEventSourceUrl,
        visitor_id: visitor_id || null,
        session_id: session_id || null,
        customer_order_index: priorOrderCount + 1,
        is_repeat_customer: priorOrderCount > 0,
        attribution: attributionClean,
        applied_coupon_id: coupon_id || null,
        coupon_discount: Math.round(serverDiscount * 100) / 100,

      };

    let createdOrder: { id: string } | null = null;
    let orderErr: any = null;
    let reusedExistingOrder = !!reusableOrder;

    if (reusableOrder) {
      const { data: updatedOrder, error: updateErr } = await supabase
        .from("orders")
        .update({
          ...orderPayload,
          // A remint is a FRESH payment attempt on this row. Anything left over
          // from the previous attempt (gateway ids, verification flags, a fired
          // Purchase marker) must be cleared, otherwise the row looks partly
          // paid / already-tracked while no money has arrived.
          payment_verified: false,
          payment_verified_at: null,
          razorpay_order_id: null,
          meta_purchase_fired_at: null,
          // A remint is a new payment attempt: stamp the order with the time it
          // is actually being attempted. Without this, an attempt that starts
          // just before midnight (or a reload minutes later) would keep the
          // original timestamp and the paid order would land in the previous
          // day's order list after the owner already packed that day.
          created_at: new Date().toISOString(),

        })
        .eq("id", reusableOrder.id)
        .eq("store_id", store_id)
        .eq("checkout_token", checkout_token)
        .eq("payment_verified", false)
        .in("status", ["pending", "cancelled", "failed"])

        .select("id")
        .maybeSingle();
      createdOrder = updatedOrder;
      orderErr = updateErr;

      // If a payment webhook won the race and made the order non-mutable while
      // this request was running, return the now-current order instead of
      // overwriting a paid row back to pending.
      if (!updateErr && !updatedOrder) {
        const { data: current } = await supabase
          .from("orders")
          .select("id, order_number")
          .eq("id", reusableOrder.id)
          .eq("store_id", store_id)
          .maybeSingle();
        if (current) {
          const currentNumber = current.order_number
            ? `#${1000 + current.order_number}`
            : `#${current.id.slice(0, 8).toUpperCase()}`;
          return new Response(
            JSON.stringify({ success: true, order_id: current.id, order_number: currentNumber, profit: null }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    } else {
      // ─── Post-payment duplicate backstop ──────────────────────────────
      // A stale AUTOMATIC re-mint (never a real tap) arriving right after the
      // shopper already paid used to rotate the checkout_token and INSERT a
      // second "Pending" row 15-60s after a partially_paid order. If this
      // request was not explicitly initiated by the shopper and the same
      // session/phone already has a paid order in the last 5 minutes, echo
      // that order back instead of creating a new one. Explicit taps
      // (user_initiated) are never blocked, so genuine repeat purchases work.
      if (user_initiated !== true && (session_id || visitor_id) && order.customer_phone) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        let pq = supabase
          .from("orders")
          .select("id, order_number")
          .eq("store_id", store_id)
          .eq("customer_phone", order.customer_phone)
          .in("status", ["paid", "partially_paid", "confirmed", "processing"])
          .gte("created_at", fiveMinAgo)
          .order("created_at", { ascending: false })
          .limit(1);
        if (session_id) pq = pq.eq("session_id", session_id);
        else if (visitor_id) pq = pq.eq("visitor_id", visitor_id);
        const { data: paidRecent } = await pq.maybeSingle();
        if (paidRecent) {
          return new Response(JSON.stringify({
            success: true,
            order_id: (paidRecent as any).id,
            order_number: (paidRecent as any).order_number,
            profit: null,
            already_paid: true,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // ─── Session-level dedup fallback ─────────────────────────────────
      // Some in-app browsers (Instagram/FB WebView, Android Chrome tabs
      // after PayU redirect) blow away React state when the shopper comes
      // back to /checkout. That mints a *fresh* checkout_token for the
      // same shopper and this branch would INSERT a second pending order
      // — the exact "two orders 27s apart, same phone/total/session" bug.
      //
      // Before inserting, look for a recent pending order from the same
      // shopper (same store + same normalized phone + same session_id or
      // visitor_id) in the last 15 minutes. Reuse it by rewriting its
      // checkout_token so downstream gateway calls stay attached.
      let dedupOrder: { id: string; order_number: number | null } | null = null;
      if (checkout_token && enteredPhone10 && (session_id || visitor_id)) {
        const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        let dq = supabase
          .from("orders")
          .select("id, order_number")
          .eq("store_id", store_id)
          .eq("customer_phone", order.customer_phone)
          .eq("status", "pending")
          .gte("created_at", fifteenMinAgo)
          .order("created_at", { ascending: false })
          .limit(1);
        if (session_id) dq = dq.eq("session_id", session_id);
        else if (visitor_id) dq = dq.eq("visitor_id", visitor_id);
        const { data: recent } = await dq.maybeSingle();
        if (recent) dedupOrder = recent as any;
      }

      if (dedupOrder) {
        // Reusing an existing pending row → its old order_items MUST be
        // replaced, not appended to (otherwise every retry duplicates the
        // line items and the dashboard shows the same product 5-7 times).
        reusedExistingOrder = true;
        const { data: updatedOrder, error: updateErr } = await supabase
          .from("orders")
          .update(orderPayload)
          .eq("id", dedupOrder.id)
          .eq("store_id", store_id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        createdOrder = updatedOrder;
        orderErr = updateErr;
      } else {
        const { data: insertedOrder, error: insertErr } = await supabase
          .from("orders")
          .insert(orderPayload)
          .select("id")
          .single();
        createdOrder = insertedOrder;
        orderErr = insertErr;
      }
    }


    if (orderErr || !createdOrder) {
      // Idempotency race: shopper double-tapped Place Order (or the browser
      // retried a slow response) — both requests passed the earlier
      // checkout_token SELECT, one won the INSERT, the other hit the unique
      // index (store_id, checkout_token). Return the winning order instead
      // of a 500 so the shopper doesn't see "order failed" for an order
      // that is actually in the merchant's dashboard.
      if ((orderErr as any)?.code === "23505" && checkout_token) {
        const { data: raced } = await supabase
          .from("orders")
          .select("id, order_number")
          .eq("store_id", store_id)
          .eq("checkout_token", checkout_token)
          .maybeSingle();
        if (raced) {
          const racedNumber = raced.order_number
            ? `#${1000 + raced.order_number}`
            : `#${raced.id.slice(0, 8).toUpperCase()}`;
          return new Response(
            JSON.stringify({ success: true, order_id: raced.id, order_number: racedNumber, profit: null }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      throw orderErr ?? new Error("Failed to create order");
    }


    const orderItems = items.map((item) => ({
      order_id: createdOrder.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: Number(item.quantity),
      unit_price: Number(item.price),
      total: Number(item.price) * Number(item.quantity),
      image_url: canonicalImage.get(item.productId) ?? (item as any).image ?? null,
    }));

    if (reusedExistingOrder) {
      const { error: deleteItemsErr } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", createdOrder.id);
      if (deleteItemsErr) throw deleteItemsErr;
    }

    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) throw itemsErr;

    // Calculate profit margin for Meta CAPI optimization
    let totalProfit: number | null = null;
    const defaultMargin = store.default_profit_margin ?? 30;
    const profitProductIds = items.map((i) => i.productId).filter(Boolean);
    if (profitProductIds.length > 0) {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, cost_price")
        .in("id", profitProductIds);

      totalProfit = 0;
      for (const item of items) {
        const prod = productsData?.find((p: any) => p.id === item.productId);
        if (prod?.cost_price !== null && prod?.cost_price !== undefined) {
          // Use actual cost price
          totalProfit += (Number(item.price) - Number(prod.cost_price)) * Number(item.quantity);
        } else {
          // Fallback: use store's default profit margin %
          totalProfit += Number(item.price) * (defaultMargin / 100) * Number(item.quantity);
        }
      }
    } else {
      // No product IDs — use default margin on total
      totalProfit = Number(order.total) * (defaultMargin / 100);
    }

    // Parallelize independent post-insert operations
    const postInsertOps: Promise<any>[] = [];

    if (lead && !reusedExistingOrder) {
      // Upsert-style: the shopper almost always already has a lead row from
      // Quick Buy / checkout step 1 (capture_checkout_lead). Inserting blindly
      // here produced a duplicate lead per order. Update the recent row
      // instead, and only insert when none exists.
      postInsertOps.push(
        (async () => {
          const { data: existingLead } = await supabase
            .from("customer_leads")
            .select("id")
            .eq("store_id", store_id)
            .eq("phone", String(lead.phone || "").replace(/\D/g, "").slice(-10))
            .gt("created_at", new Date(Date.now() - 12 * 3600 * 1000).toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existingLead?.id) {
            return supabase
              .from("customer_leads")
              .update({
                name: lead.name ?? undefined,
                product_name: lead.product_name ?? undefined,
                product_id: lead.product_id ?? undefined,
                source: lead.source,
              })
              .eq("id", existingLead.id);
          }
          return supabase.from("customer_leads").insert({
            store_id,
            name: lead.name,
            phone: lead.phone,
            product_name: lead.product_name,
            product_id: lead.product_id,
            source: lead.source,
          });
        })(),
      );
    }

    // Coupon usage was already atomically incremented above via claim_coupon RPC.


    // Only mark the cart as recovered when the order is ACTUALLY placed
    // (COD → status="confirmed"). For online payments the order starts as
    // "pending" and only becomes confirmed after the payment-verify webhook.
    // If we mark recovered here for online orders, a failed/cancelled payment
    // leaves the cart flagged as recovered forever and the recovery cron
    // skips it — customer never gets their abandoned-cart WhatsApp.
    if (abandoned_cart_id && order.status === "confirmed") {
      postInsertOps.push(
        supabase
          .from("abandoned_carts")
          .update({ recovered: true })
          .eq("id", abandoned_cart_id)
      );
    }

    // Fetch order_number in parallel with other ops
    const orderNumberPromise = supabase
      .from("orders")
      .select("order_number")
      .eq("id", createdOrder.id)
      .single();

    postInsertOps.push(orderNumberPromise);

    const results = await Promise.all(postInsertOps);

    // Extract order_number from the last result
    const orderNumberResult = results[results.length - 1];
    const orderRow = orderNumberResult?.data;
    const orderNumber = orderRow?.order_number
      ? `#${1000 + orderRow.order_number}`
      : `#${createdOrder.id.slice(0, 8).toUpperCase()}`;

    // For COD orders the order is "complete" the moment it's placed — fire Purchase CAPI
    // server-to-server now (matches Shopify default behaviour). Razorpay/Cashfree orders
    // get their Purchase fired from the verify/webhook step instead.
    // ⚠️ Skip Meta CAPI for manual / admin-created orders (no browser session signals).
    // Sending those tanks Event Match Quality and adds noise without attribution value.
    const isStorefrontOrder = !!buyerUa && !!(buyerFbp || buyerFbc || metaEventId);
    if (order.payment_method === "cod" && isStorefrontOrder) {
      runInBackground(firePurchaseCapi(supabase, createdOrder.id, {
        source: "cod",
        eventSourceUrl: metaEventSourceUrl || undefined,
      }), "place-order CAPI");
    }

    return new Response(JSON.stringify({ success: true, order_id: createdOrder.id, order_number: orderNumber, profit: totalProfit }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("place-order error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to place order" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
