// Branded WhatsApp button redirector.
// URL: https://shopbanao.in/r/<token>  → main.tsx forwards to this fn → 302 to store domain.
// Token formats:
//   o-<order_uuid>      → /account/orders/<id> on store's domain
//   t-<order_uuid>      → tracking_url (fall back to order page)
//   c-<cart_id_or_token>→ /cart?recover=<token> on store's domain
//   p-<product_uuid>    → /product/<slug> on store's domain
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function storeBase(s: any): string {
  if (!s) return "https://shopbanao.in";
  if (s.custom_domain) return `https://${s.custom_domain}`;
  if (s.slug) return `https://${s.slug}.shopbanao.in`;
  return "https://shopbanao.in";
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Path is /functions/v1/wa-r/<token>  — grab the last segment.
  const parts = url.pathname.split("/").filter(Boolean);
  const token = (parts[parts.length - 1] || "").trim();
  if (!token || token === "wa-r") return redirect("https://shopbanao.in");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const kind = token.slice(0, 2);
  const id = token.slice(2);

  // Fire-and-forget click log. Never blocks the redirect.
  const ua = req.headers.get("user-agent") || "";
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
  admin.from("wa_link_clicks").insert({
    token, kind, ref_id: id, user_agent: ua.slice(0, 256), ip_address: ip.split(",")[0].trim() || null,
  } as any).then(() => {}, () => {});

  try {
    if (kind === "o-" || kind === "t-") {
      const { data: o } = await admin
        .from("orders")
        .select("id, tracking_url, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!o) return redirect("https://shopbanao.in");
      const base = storeBase((o as any).stores);
      if (kind === "t-" && (o as any).tracking_url) return redirect((o as any).tracking_url);
      return redirect(`${base}/account/orders/${(o as any).id}`);
    }
    if (kind === "c-") {
      const { data: c } = await admin
        .from("abandoned_carts")
        .select("id, session_token, stores:store_id(name, slug, custom_domain)")
        .eq("id", id).maybeSingle();
      if (!c) return redirect("https://shopbanao.in");
      const base = storeBase((c as any).stores);
      const t = (c as any).session_token || (c as any).id;
      return redirect(`${base}/cart?recover=${encodeURIComponent(String(t))}`);
    }
  } catch { /* fallthrough */ }
  return redirect("https://shopbanao.in");
});

function redirect(to: string): Response {
  return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });
}
