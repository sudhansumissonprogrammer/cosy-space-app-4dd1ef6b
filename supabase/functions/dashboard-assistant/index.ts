import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { HELP_ARTICLES, type HelpArticle } from "./knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Model is discovered from the live gateway listing on first use, so the
// assistant follows the current model generation instead of a pinned id that
// silently ages out. FALLBACK_MODEL is only used if the listing is unreachable.
const FALLBACK_MODEL = "google/gemini-3.7-flash";
const MODEL_PREFERENCE = [
  "google/gemini-3.7-flash",
  "google/gemini-3.6-flash",
  "google/gemini-3.1-flash-lite",
];
let cachedModel: string | null = null;

async function pickModel(): Promise<string> {
  if (cachedModel) return cachedModel;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/models", {
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
    });
    if (res.ok) {
      const list = await res.json();
      const ids = new Set(
        (list?.data ?? [])
          .filter((m: any) => !m?.deprecated)
          .map((m: any) => m?.id),
      );
      cachedModel = MODEL_PREFERENCE.find((id) => ids.has(id)) ?? FALLBACK_MODEL;
      return cachedModel;
    }
  } catch (e) {
    console.error("model listing failed", e);
  }
  cachedModel = FALLBACK_MODEL;
  return cachedModel;
}

const MAX_TURNS = 12;
const RATE_LIMIT_PER_HOUR = 60;


/* ------------------------------------------------------------------ */
/* Retrieval — keyword scoring over the bundled knowledge base         */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  "how", "do", "i", "the", "a", "an", "to", "my", "in", "on", "of", "is", "it",
  "can", "for", "and", "me", "you", "we", "please", "kaise", "kya", "kar",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreArticle(a: HelpArticle, q: string, qTokens: string[]): number {
  const hay = `${a.title} ${a.keywords.join(" ")}`.toLowerCase();
  const bodyHay = a.body.toLowerCase();
  let score = 0;
  for (const kw of a.keywords) if (q.includes(kw)) score += 6;
  for (const t of qTokens) {
    if (hay.includes(t)) score += 3;
    else if (bodyHay.includes(t)) score += 1;
  }
  return score;
}

// Hindi / Hinglish → English hints. Merchants type "pixel kaise lagaye",
// "paisa kab milega", "delivery charge kaise set kare" — without this the
// keyword scorer only matched the few English words in the sentence.
const SYNONYMS: Record<string, string> = {
  lagaye: "add", lagana: "add", jode: "add", jodna: "add", banaye: "create",
  banana: "create", banaun: "create", karu: "do", kare: "do", karna: "do",
  dukan: "store", dukaan: "store", saman: "product", samaan: "product",
  daam: "price", keemat: "price", paisa: "payment money", paise: "payment money",
  rupaye: "payment", bhugtan: "payment", grahak: "customer", grahak_: "customer",
  order_: "order", delivery: "shipping", courier: "shipping",
  vapas: "return refund", wapas: "return refund", refund_: "refund",
  chhut: "discount", chhoot: "discount", vigyapan: "ads pixel",
  ad: "ads pixel", ads: "pixel meta facebook", fb: "facebook meta pixel",
  domain_: "domain", website: "domain store", link: "share link",
  photo: "image", tasveer: "image", nahi: "not", dikh: "showing",
  raha: "", rahi: "", kaise: "how", kyu: "why", kyun: "why", kab: "when",
};

function expand(question: string): string {
  const extra = tokens(question).map((t) => SYNONYMS[t] ?? "").filter(Boolean);
  return extra.length ? `${question} ${extra.join(" ")}` : question;
}

function retrieve(question: string, page?: string, limit = 8): HelpArticle[] {
  const expanded = expand(question);
  const q = expanded.toLowerCase();
  const qTokens = tokens(expanded);

  const ranked = HELP_ARTICLES
    .map((a) => {
      let score = scoreArticle(a, q, qTokens);
      // Slight boost for the page the merchant is currently looking at.
      if (page && a.route !== "/dashboard" && page.includes(a.route.replace("{s}", ""))) score += 2;
      return { a, score };
    })
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((r) => r.a);

  // Never send an empty context — fall back to the orientation articles.
  if (ranked.length === 0) {
    return HELP_ARTICLES.filter((a) =>
      ["store-settings", "payments-overview", "add-product", "orders-manage"].includes(a.id),
    );
  }
  return ranked;
}

/* ------------------------------------------------------------------ */
/* Live store snapshot — booleans and counts only, never secrets       */
/* ------------------------------------------------------------------ */

async function buildStoreSnapshot(admin: any, storeId: string) {
  const [store, pay, ship, tax, counts] = await Promise.all([
    admin.from("stores").select("name, slug, custom_domain, domain_verified, theme, billing_mode, whatsapp_number, logo_url, about_us_text, meta_title, facebook_pixel_id, partial_payment_enabled").eq("id", storeId).maybeSingle(),
    admin.from("store_payment_config").select("*").eq("store_id", storeId).maybeSingle(),
    admin.from("store_shipping_config").select("*").eq("store_id", storeId).maybeSingle(),
    admin.from("store_tax_config").select("*").eq("store_id", storeId).maybeSingle(),
    admin.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
  ]);

  const s = store?.data ?? {};
  const p = pay?.data ?? {};
  const methods: string[] = Array.isArray(p?.payment_methods) ? p.payment_methods : [];

  return {
    store_name: s.name ?? null,
    store_url: s.custom_domain
      ? `https://${s.custom_domain}`
      : s.slug ? `https://${s.slug}.shopbanao.in` : null,
    custom_domain_connected: !!s.custom_domain && !!s.domain_verified,
    theme: s.theme ?? null,
    billing_mode: s.billing_mode ?? null,
    products_count: counts?.count ?? 0,
    logo_uploaded: !!s.logo_url,
    about_us_written: !!s.about_us_text,
    seo_meta_title_set: !!s.meta_title,
    whatsapp_number_set: !!s.whatsapp_number,
    meta_pixel_connected: !!s.facebook_pixel_id,
    partial_cod_enabled: !!s.partial_payment_enabled,
    payments: {
      enabled_methods: methods,
      razorpay_keys_saved: !!p?.razorpay_key_id,
      cashfree_keys_saved: !!p?.cashfree_app_id,
      payu_keys_saved: !!p?.payu_merchant_key,
      cod_enabled: methods.includes("cod"),
      prepaid_discount_enabled: !!p?.prepaid_discount_enabled,
    },
    shipping_configured: !!ship?.data,
    tax_configured: !!tax?.data,
  };
}

/* ------------------------------------------------------------------ */

function systemPrompt(snapshot: unknown, articles: HelpArticle[], slug: string, page?: string) {
  const s = `/dashboard/stores/${slug}`;
  const context = articles
    .map((a) => `### ${a.title}\nPage: ${a.route.replace("{s}", s)}\n${a.body}`)
    .join("\n\n");
  // Full map of everything the dashboard can do. Even when keyword retrieval
  // misses, the assistant can still point the merchant at the right page and
  // offer to explain it, instead of answering "I don't know".
  const siteMap = HELP_ARTICLES
    .map((a) => `- ${a.title} → ${a.route.replace("{s}", s)}`)
    .join("\n");


  return `You are the Store Assistant inside the ShopBanao merchant dashboard. You help shop owners in India run their online store.

HOW TO ANSWER
- Answer ONLY from the HELP CONTEXT below. If it does not cover the question, say you are not sure and suggest contacting support — never invent a setting, field or page.
- Be short and practical: numbered steps, one action per step.
- Always name the dashboard page and give its link path exactly as written in the context (e.g. ${s}/payments).
- Use the STORE STATUS to personalise: if something is already set up say so; if it is missing, start the steps there.
- Reply in the same language the merchant used (English, Hindi or Hinglish).
- Never ask for, show or repeat API keys, passwords or tokens.
- You cannot change any setting yourself — you explain and link; the merchant clicks.

STORE STATUS (live)
${JSON.stringify(snapshot, null, 2)}

CURRENT PAGE: ${page || "unknown"}

HELP CONTEXT
${context}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Not signed in" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = await req.json().catch(() => null);
    const message: string = (body?.message ?? "").toString().trim();
    const storeId: string = (body?.store_id ?? "").toString();
    const page: string | undefined = body?.page ? String(body.page).slice(0, 200) : undefined;
    const history: Array<{ role: string; content: string }> = Array.isArray(body?.history) ? body.history : [];
    let conversationId: string | null = body?.conversation_id ?? null;

    if (!message || message.length > 2000) return json({ error: "Please type a shorter question." }, 400);
    if (!storeId) return json({ error: "Missing store" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Ownership check — merchant owns the store, or platform admin.
    const { data: storeRow } = await admin
      .from("stores").select("id, slug, owner_id").eq("id", storeId).maybeSingle();
    if (!storeRow) return json({ error: "Store not found" }, 404);

    if (storeRow.owner_id !== user.id) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Not allowed" }, 403);
    }

    // Rate limit — per user, per hour.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recent } = await admin
      .from("assistant_messages")
      .select("id, assistant_conversations!inner(user_id)", { count: "exact", head: true })
      .eq("role", "user")
      .eq("assistant_conversations.user_id", user.id)
      .gte("created_at", since);
    if ((recent ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return json({ error: "You've asked a lot of questions this hour. Please try again shortly." }, 429);
    }

    // Conversation
    if (conversationId) {
      const { data: conv } = await admin
        .from("assistant_conversations").select("id, user_id, store_id").eq("id", conversationId).maybeSingle();
      // Must belong to this user AND this store — a conversation id from another
      // store of the same user must not leak into this store's thread.
      if (!conv || conv.user_id !== user.id || conv.store_id !== storeId) conversationId = null;
    }
    if (!conversationId) {
      const { data: created } = await admin
        .from("assistant_conversations")
        .insert({ store_id: storeId, user_id: user.id, title: message.slice(0, 80) })
        .select("id").single();
      conversationId = created?.id ?? null;
    }

    const articles = retrieve(message, page);
    const snapshot = await buildStoreSnapshot(admin, storeId);

    const messages = [
      { role: "system", content: systemPrompt(snapshot, articles, storeRow.slug, page) },
      ...history
        .slice(-MAX_TURNS)
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
      { role: "user", content: message },
    ];

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({ model: MODEL, messages, stream: true, service_tier: "priority" }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      console.error("gateway error", upstream.status, text);
      const msg =
        upstream.status === 429
          ? "The assistant is busy right now. Please try again in a moment."
          : upstream.status === 402
            ? "AI credits are exhausted for this workspace. Please add credits to keep the assistant running."
            : upstream.status === 403
              ? "The assistant is disabled for this workspace."
              : "The assistant could not answer right now.";
      return json({ error: msg }, upstream.status === 429 || upstream.status >= 500 ? 503 : 400);
    }

    if (conversationId) {
      await admin.from("assistant_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: message,
      });
    }

    // Pipe SSE through to the browser while accumulating the answer for storage.
    let answer = "";
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const sources = articles.map((a) => ({ id: a.id, title: a.title, route: a.route.replace("{s}", `/dashboard/stores/${storeRow.slug}`) }));

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`event: meta\ndata: ${JSON.stringify({ conversation_id: conversationId, sources })}\n\n`),
        );
        const reader = upstream.body!.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            controller.enqueue(value);
            let idx: number;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, idx).trim();
              buffer = buffer.slice(idx + 1);
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload);
                answer += parsed?.choices?.[0]?.delta?.content ?? "";
              } catch (_) { /* partial JSON — ignore */ }
            }
          }
        } catch (e) {
          console.error("stream error", e);
        } finally {
          controller.close();
          if (conversationId && answer) {
            await admin.from("assistant_messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: answer,
              sources,
            });
            await admin.from("assistant_conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", conversationId);
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("dashboard-assistant error", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
