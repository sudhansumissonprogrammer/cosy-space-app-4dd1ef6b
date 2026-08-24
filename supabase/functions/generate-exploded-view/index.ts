/**
 * generate-exploded-view — Generates a photoreal "exploded view" render of a
 * product from its own catalog photo (Gemini image model via Lovable AI
 * Gateway), converts the result to WebP, stores it on R2 and appends it to the
 * product's PDP gallery (product_images).
 *
 * POST { product_id: string, also_product_ids?: string[], display_order?: number,
 *        prompt_extra?: string, dry_run?: boolean }
 *
 * Auth: platform admin, the owning merchant, or service-role.
 *
 * `also_product_ids` lets a single generation be reused across mirrored stores
 * (same source photo) without paying for the render twice.
 */
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2";
import encodeWebp from "npm:@jsquash/webp@1.4.0/encode.js";
import decodePng from "npm:@jsquash/png@3.1.0/decode.js";
import decodeJpeg from "npm:@jsquash/jpeg@1.5.0/decode.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";
const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") || "").replace(/\/+$/, "");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});
const r2Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`;

const BASE_PROMPT = `Recreate the EXACT watch shown in the reference photo as a premium photorealistic exploded-view product render.

Absolute fidelity rules — the watch identity must stay 100% faithful to the photo:
- Same case shape, bezel design, screws/bolts, crown and pusher layout, lug shape and finish (steel / rose gold / black PVD exactly as in the photo).
- Same dial: identical colour, texture, sub-dial positions, index style, hand shapes, logo placement and printed text layout.
- Same strap/bracelet: identical material, colour, stitching and buckle design.
- Do not restyle, do not change brand cues, do not invent a different model.

Composition:
- Vertically stacked exploded assembly, components floating apart with clean even spacing, slight 3/4 perspective, as if the watch was disassembled layer by layer.
- Layers from top to bottom: crystal glass, bezel ring, dial with hands, chronograph/movement module, case body with crown and pushers, case back, then the strap halves with buckle laid below.
- Thin light callout lines from each component to small minimal numbered labels (1-9) placed in clean empty space.
- Studio product photography lighting: soft key light, gentle reflections, crisp micro-detail on metal brushing and leather grain, realistic soft contact shadows.
- Background: dark polished marble / graphite gradient surface, luxurious and uncluttered.
- Ultra sharp 3D render quality, 8k detail, no cartoon or vector look, no watermark.

Label text must stay generic and non-technical-claiming: use words like GLASS, BEZEL, DIAL, HANDS, CHRONO MODULE, CASE, CROWN, CASE BACK, STRAP, BUCKLE. Never print brand-specific specifications, never print prices or extra marketing copy.`;

async function fetchAsDataUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`source image fetch ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) return json({ error: "AI gateway key missing" }, 500);
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
      return json({ error: "R2 not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    // Internal/cron callers present the shared cron secret; treated as admin.
    const providedCron = req.headers.get("x-cron-secret") || "";
    let isInternal = false;
    if (providedCron) {
      const { data: cronRow } = await supabase.from("cron_auth").select("secret").eq("id", true).maybeSingle();
      const cronSecret = (cronRow as { secret?: string } | null)?.secret || Deno.env.get("CRON_SECRET") || "";
      isInternal = !!cronSecret && providedCron === cronSecret;
    }

    const isServiceRole = isInternal || token === serviceRoleKey;
    let callerUid: string | null = null;
    if (!isServiceRole) {
      const { data: claims } = await supabase.auth.getClaims(token);
      callerUid = (claims?.claims?.sub as string) || null;
      if (!callerUid) return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const productId: string | undefined = body.product_id;
    if (!productId) return json({ error: "product_id required" }, 400);
    const alsoIds: string[] = Array.isArray(body.also_product_ids) ? body.also_product_ids : [];
    const promptExtra: string = typeof body.prompt_extra === "string" ? body.prompt_extra : "";

    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, image_url, store_id")
      .eq("id", productId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!product?.image_url) return json({ error: "Product or image not found" }, 404);

    if (!isServiceRole && callerUid) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerUid, _role: "admin" });
      if (!isAdmin) {
        const { data: store } = await supabase
          .from("stores").select("owner_id").eq("id", product.store_id).maybeSingle();
        if (!store || store.owner_id !== callerUid) return json({ error: "Forbidden" }, 403);
      }
    }

    const dataUrl = await fetchAsDataUrl(product.image_url);
    if (body.dry_run) return json({ ok: true, product: product.name, source: product.image_url });

    // ---- Generate (Gemini image model, chat-completions image shape) ----
    const genRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${BASE_PROMPT}\n\nProduct title (use ONLY to double-check colours/materials, never print it): "${product.name}". The dial colour, case metal finish and strap colour named in this title MUST match the render exactly.${promptExtra ? `\n\nAdditional direction: ${promptExtra}` : ""}`,
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!genRes.ok) {
      const errTxt = await genRes.text().catch(() => "");
      console.error("[exploded] gateway error", genRes.status, errTxt);
      return json({ error: `Image generation failed: ${genRes.status}`, detail: errTxt }, genRes.status);
    }
    const genJson = await genRes.json();
    const b64 = genJson?.data?.[0]?.b64_json;
    if (!b64) return json({ error: "Generation returned no image" }, 502);

    // ---- PNG -> WebP ----
    const raw = b64ToBytes(b64);
    let outBytes = raw;
    let contentType = "image/png";
    let ext = "png";
    try {
      const isPng = raw[0] === 0x89 && raw[1] === 0x50;
      const imageData = isPng ? await decodePng(raw) : await decodeJpeg(raw);
      const webp = await encodeWebp(imageData, { quality: 82 });
      outBytes = new Uint8Array(webp);
      contentType = "image/webp";
      ext = "webp";
    } catch (convErr) {
      console.warn("[exploded] webp convert failed, storing original:", convErr);
    }

    const key = `product-images/exploded/${productId}-exploded-${Date.now()}.${ext}`;
    const put = await r2.fetch(`${r2Endpoint}/${key}`, {
      method: "PUT",
      body: outBytes,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    if (!put.ok) {
      const t = await put.text();
      console.error("[exploded] R2 PUT failed", put.status, t);
      return json({ error: `R2 upload failed: ${put.status}` }, 502);
    }
    await put.text();
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    // ---- Attach to PDP gallery(ies) ----
    const targets = [productId, ...alsoIds.filter((id) => id && id !== productId)];
    const attached: Record<string, string> = {};
    for (const id of targets) {
      const { data: existing } = await supabase
        .from("product_images")
        .select("image_url, display_order")
        .eq("product_id", id);
      if ((existing || []).some((r) => r.image_url === publicUrl)) {
        attached[id] = "already-attached";
        continue;
      }
      const nextOrder = typeof body.display_order === "number"
        ? body.display_order
        : Math.max(0, ...(existing || []).map((r) => r.display_order ?? 0)) + 1;
      const { error: insErr } = await supabase.from("product_images").insert({
        product_id: id,
        image_url: publicUrl,
        display_order: nextOrder,
        image_alt: `${product.name} exploded view — components breakdown`,
      });
      attached[id] = insErr ? `error: ${insErr.message}` : `order ${nextOrder}`;
    }

    return json({
      ok: true,
      product: product.name,
      source: product.image_url,
      url: publicUrl,
      bytes: outBytes.length,
      format: contentType,
      attached,
    });
  } catch (err) {
    console.error("[generate-exploded-view]", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
