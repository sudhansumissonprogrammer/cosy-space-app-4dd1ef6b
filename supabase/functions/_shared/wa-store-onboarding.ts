// WhatsApp-only "ready-made store" agent.
// A person chats with the shared ShopBanao WhatsApp number; we ask a few
// questions, then create the merchant account + store with the SAME steps the
// web CreateStore page uses (run with the new owner's own session so RLS and
// every downstream function behave identically), and reply with credentials.
//
// Only starts on explicit trigger phrases / the campaign button, so normal
// shopper messages on the shared number are never hijacked.

import { createClient } from "npm:@supabase/supabase-js@2";
import { metaFetch } from "./wa-platform.ts";
import { mintUserSession } from "./auth-session-mint.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const MERCHANT_EMAIL_DOMAIN = "merchant.shopbanao.in";
const MAX_MESSAGES = 60;

const TRIGGER_RE =
  /(create|make|build|get|start|open)\s*(my|a|free|own)?\s*(online\s*)?(store|shop|website|dukaan|dukan)|store\s*banao|shop\s*banao|dukaan\s*banao|apna\s*(store|dukaan|shop)|^create_store$/i;
const RESTART_RE = /^(restart|start over|reset|फिर से)$/i;

export const CATEGORIES = [
  "Jewellery", "Clothing", "Sarees & Ethnic", "Watches", "Beauty & Cosmetics",
  "Footwear", "Bags & Accessories", "Home & Kitchen", "Electronics", "Other",
];

const RESERVED = new Set([
  "www", "admin", "api", "app", "dashboard", "login", "shop", "store", "cdn", "mail",
  "shopbanao", "support", "help", "blog", "static", "assets", "partner", "partners",
]);

type Inbound = {
  phone: string; // E.164 digits (e.g. 9198xxxxxxxx)
  text: string;
  buttonId: string | null;
  msgType: string;
  mediaId: string | null;
};

type Ctx = { admin: any; phoneNumberId: string; token: string };

// ─────────────────────────── sending ───────────────────────────
async function send(ctx: Ctx, to: string, payload: Record<string, unknown>, logBody: string) {
  const res = await metaFetch(
    ctx.admin,
    `${GRAPH}/${ctx.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
    },
    { source: "wa-store-onboarding" },
  );
  if (!res.ok) console.error("[wa-onboard] send failed", res.status, JSON.stringify(res.body).slice(0, 300));
  try {
    await ctx.admin.from("whatsapp_messages").insert({
      store_id: null,
      message_type: "onboarding",
      recipient_phone: to,
      message_body: logBody.slice(0, 2000),
      status: res.ok ? "sent" : "failed",
      direction: "outgoing",
      meta_message_id: res.body?.messages?.[0]?.id ?? null,
      sent_via: "platform",
    });
  } catch { /* logging is best-effort */ }
  return res.ok;
}

const text = (ctx: Ctx, to: string, body: string) =>
  send(ctx, to, { type: "text", text: { body, preview_url: true } }, body);

const buttons = (ctx: Ctx, to: string, body: string, btns: { id: string; title: string }[]) =>
  send(ctx, to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: { buttons: btns.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  }, `${body}\n[${btns.map((b) => b.title).join("] [")}]`);

const categoryList = (ctx: Ctx, to: string, body: string) =>
  send(ctx, to, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: "Choose category",
        sections: [{ title: "Categories", rows: CATEGORIES.map((c, i) => ({ id: `CAT_${i}`, title: c.slice(0, 24) })) }],
      },
    },
  }, `${body}\n(category list)`);

// ─────────────────────────── helpers ───────────────────────────
function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "").slice(0, 30);
}

async function freeSlug(admin: any, base: string): Promise<string | null> {
  if (!base || base.length < 3) return null;
  const candidates = RESERVED.has(base) ? [] : [base];
  candidates.push(`${base}store`, `${base}shop`, `${base}official`);
  for (let i = 1; i <= 5; i++) candidates.push(`${base}${i}`);
  for (const c of candidates) {
    const { data } = await admin.from("stores").select("id").eq("slug", c).maybeSingle();
    if (!data) return c;
  }
  return null;
}

function normaliseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t || /\s/.test(t)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!u.hostname.includes(".") || u.hostname.endsWith(".local")) return null;
    return u.toString();
  } catch { return null; }
}

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let p = "";
  for (const b of bytes) p += alphabet[b % alphabet.length];
  return `${p}@${(bytes[0] % 90) + 10}`;
}

async function saveSession(admin: any, phone: string, patch: Record<string, unknown>) {
  await admin.from("wa_onboarding_sessions").update(patch).eq("phone", phone);
}

// ─────────────────────────── entry ───────────────────────────
/** Returns true when the message belonged to the onboarding agent. */
export async function handleStoreOnboarding(ctx: Ctx, msg: Inbound): Promise<boolean> {
  const { admin } = ctx;
  const phone = msg.phone;
  const input = (msg.text || "").trim();
  const id = msg.buttonId || "";

  const { data: existing } = await admin
    .from("wa_onboarding_sessions").select("*").eq("phone", phone).maybeSingle();

  const isTrigger = id === "CREATE_STORE" || TRIGGER_RE.test(input);

  // Not in a chat and not asking for a store → let the normal inbox handle it.
  if (!existing && !isTrigger) return false;
  if (existing && ["done", "creating"].includes(existing.status) && !isTrigger) {
    if (existing.status === "creating") {
      await text(ctx, phone, "⏳ Your store is being built right now — you'll get the login details here in a minute.");
      return true;
    }
    return false;
  }

  // Already has a ShopBanao store → don't create a second one.
  if (isTrigger && (!existing || existing.status !== "active")) {
    const owned = await findOwnedStore(admin, phone);
    if (owned) {
      await sendExistingLogin(ctx, phone, owned);
      return true;
    }
  }

  if (!existing || isTrigger && existing.status !== "active" || RESTART_RE.test(input) || id === "RESTART") {
    await admin.from("wa_onboarding_sessions").upsert({
      phone, step: "brand", answers: {}, status: "active", message_count: 0, last_error: null,
    }, { onConflict: "phone" });
    await text(ctx, phone,
      "👋 Welcome to *ShopBanao*! Let's build your online store right here on WhatsApp — it takes about 2 minutes.\n\n" +
      "1️⃣ What is your *brand / shop name*?");
    return true;
  }

  const s = existing;
  if (s.message_count >= MAX_MESSAGES) {
    await text(ctx, phone, "We received too many messages. Please type *restart* to begin again.");
    return true;
  }
  await saveSession(admin, phone, { message_count: s.message_count + 1 });
  const answers = { ...(s.answers || {}) };

  switch (s.step) {
    case "brand": {
      const name = input.replace(/\s+/g, " ").slice(0, 40);
      if (msg.msgType !== "text" || name.length < 2 || !/[a-z0-9]/i.test(name)) {
        await text(ctx, phone, "Please type your brand / shop name (for example: *Riya Jewels*).");
        return true;
      }
      const slug = await freeSlug(admin, slugify(name));
      if (!slug) {
        await text(ctx, phone, "That name can't be used as a store address. Please try a slightly different name.");
        return true;
      }
      answers.brand = name;
      answers.slug = slug;
      await saveSession(admin, phone, { answers, step: "brand_ok" });
      await buttons(ctx, phone,
        `Great! Your store address will be:\n🌐 *${slug}.shopbanao.in*\n\nShall we use this?`,
        [{ id: "SLUG_OK", title: "Yes, use it" }, { id: "SLUG_CHANGE", title: "Change name" }]);
      return true;
    }
    case "brand_ok": {
      if (id === "SLUG_CHANGE" || /^(no|change)/i.test(input)) {
        await saveSession(admin, phone, { step: "brand" });
        await text(ctx, phone, "No problem — type the new brand / shop name.");
        return true;
      }
      if (id !== "SLUG_OK" && !/^(yes|ok|haan|han|ha)\b/i.test(input)) {
        await buttons(ctx, phone, `Use *${answers.slug}.shopbanao.in*?`,
          [{ id: "SLUG_OK", title: "Yes, use it" }, { id: "SLUG_CHANGE", title: "Change name" }]);
        return true;
      }
      await saveSession(admin, phone, { step: "category" });
      await categoryList(ctx, phone, "2️⃣ What do you sell? Choose a category below, or just type it (e.g. *imitation jewellery*).");
      return true;
    }
    case "category": {
      let cat = "";
      const m = /^CAT_(\d+)$/.exec(id);
      if (m) cat = CATEGORIES[Number(m[1])] || "";
      else if (msg.msgType === "text" && input.length >= 2) cat = input.slice(0, 60);
      if (!cat) {
        await categoryList(ctx, phone, "Please choose what you sell, or type it.");
        return true;
      }
      answers.business_type = cat;
      if (!m) answers.description = input.slice(0, 200);
      await saveSession(admin, phone, { answers, step: "website" });
      await buttons(ctx, phone,
        "3️⃣ Do you already have a website or online store? Send its link and we'll copy your products.\n\nNo website? Tap *Skip*.",
        [{ id: "SKIP_WEBSITE", title: "Skip" }]);
      return true;
    }
    case "website": {
      if (id !== "SKIP_WEBSITE" && !/^(skip|no|nahi|nahin)$/i.test(input)) {
        const url = normaliseUrl(input);
        if (!url) {
          await buttons(ctx, phone, "That doesn't look like a website link. Send a link like *myshop.com*, or tap Skip.",
            [{ id: "SKIP_WEBSITE", title: "Skip" }]);
          return true;
        }
        answers.website = url;
      } else {
        answers.website = null;
      }
      await saveSession(admin, phone, { answers, step: "logo" });
      await buttons(ctx, phone, "4️⃣ Send your *logo* as a photo 🖼️\n\nNo logo? Tap *Skip* and we'll make a clean text logo.",
        [{ id: "SKIP_LOGO", title: "Skip" }]);
      return true;
    }
    case "logo": {
      if (msg.msgType === "image" && msg.mediaId) {
        answers.logo_media_id = msg.mediaId;
      } else if (id === "SKIP_LOGO" || /^(skip|no|nahi)$/i.test(input)) {
        answers.logo_media_id = null;
      } else {
        await buttons(ctx, phone, "Please send your logo as a photo, or tap Skip.", [{ id: "SKIP_LOGO", title: "Skip" }]);
        return true;
      }
      await saveSession(admin, phone, { answers, step: "owner" });
      await text(ctx, phone, "5️⃣ Last one — what is *your name*? (We'll use it on your About Us page.)");
      return true;
    }
    case "owner": {
      const owner = input.replace(/\s+/g, " ").slice(0, 50);
      if (msg.msgType !== "text" || owner.length < 2) {
        await text(ctx, phone, "Please type your name.");
        return true;
      }
      answers.owner_name = owner;
      await saveSession(admin, phone, { answers, step: "confirm" });
      await buttons(ctx, phone,
        `✅ Please check:\n\n🏷️ Brand: *${answers.brand}*\n🌐 Address: *${answers.slug}.shopbanao.in*\n🛍️ Sells: *${answers.business_type}*\n` +
        `🔗 Old website: ${answers.website || "None"}\n🖼️ Logo: ${answers.logo_media_id ? "Received" : "Text logo"}\n👤 Owner: *${owner}*`,
        [{ id: "CONFIRM_CREATE", title: "Create my store" }, { id: "RESTART", title: "Start over" }]);
      return true;
    }
    case "confirm": {
      if (id !== "CONFIRM_CREATE" && !/^(yes|create|ok|haan|confirm)\b/i.test(input)) {
        await buttons(ctx, phone, "Tap *Create my store* to finish, or *Start over* to change something.",
          [{ id: "CONFIRM_CREATE", title: "Create my store" }, { id: "RESTART", title: "Start over" }]);
        return true;
      }
      const { data: claimed } = await admin.rpc("claim_wa_onboarding_create", { _phone: phone });
      if (!claimed) return true; // double tap — another request is already building it
      await text(ctx, phone, "🚀 Building your store now… adding your theme, products and pages. This takes about a minute.");
      try {
        await provisionStore(ctx, phone, answers);
      } catch (e) {
        const err = (e as Error).message || "unknown";
        console.error("[wa-onboard] provision failed", err);
        await saveSession(admin, phone, { status: "active", step: "confirm", last_error: err.slice(0, 500) });
        await buttons(ctx, phone, "😔 Something went wrong while creating your store. Please tap *Create my store* to try again.",
          [{ id: "CONFIRM_CREATE", title: "Create my store" }]);
      }
      return true;
    }
    default:
      return false;
  }
}

// ─────────────────────────── existing accounts ───────────────────────────
async function findOwnedStore(admin: any, e164: string) {
  const p10 = e164.slice(-10);
  const { data: uid } = await admin.rpc("get_user_id_by_phone", { _phone: p10 });
  let userId = typeof uid === "string" ? uid : null;
  if (!userId) {
    const { data: u2 } = await admin.rpc("get_auth_user_id_by_email", { _email: `${p10}@${MERCHANT_EMAIL_DOMAIN}` });
    userId = typeof u2 === "string" ? u2 : null;
  }
  if (!userId) return null;
  const { data: store } = await admin.from("stores").select("id, slug, name").eq("owner_id", userId)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!store) return null;
  const { data: u } = await admin.auth.admin.getUserById(userId);
  return { ...store, userId, email: u?.user?.email as string | undefined };
}

async function magicLink(admin: any, email: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.generateLink({
      type: "magiclink", email, options: { redirectTo: "https://shopbanao.in/dashboard" },
    });
    return data?.properties?.action_link ?? null;
  } catch { return null; }
}

async function sendExistingLogin(ctx: Ctx, phone: string, owned: any) {
  const link = owned.email ? await magicLink(ctx.admin, owned.email) : null;
  await text(ctx, phone,
    `You already have a ShopBanao store: *${owned.name}*\n🌐 https://${owned.slug}.shopbanao.in\n\n` +
    (link ? `🔐 One-tap login (valid 1 hour):\n${link}\n\n` : "") +
    `Or log in at https://shopbanao.in/login with your mobile number.`);
}

// ─────────────────────────── provisioning ───────────────────────────
async function provisionStore(ctx: Ctx, phone: string, a: Record<string, any>) {
  const { admin } = ctx;
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const p10 = phone.slice(-10);

  // Race guard: someone may have created a store for this phone meanwhile.
  const owned = await findOwnedStore(admin, phone);
  if (owned) {
    await saveSession(admin, phone, { status: "done", step: "done", store_id: owned.id, user_id: owned.userId });
    await sendExistingLogin(ctx, phone, owned);
    return;
  }

  // 1) Account — reuse a phone-linked merchant account if one exists.
  let userId: string | null = null;
  let email = `${p10}@${MERCHANT_EMAIL_DOMAIN}`;
  let password: string | null = null;
  const { data: byPhone } = await admin.rpc("get_user_id_by_phone", { _phone: p10 });
  if (typeof byPhone === "string") {
    userId = byPhone;
    const { data: u } = await admin.auth.admin.getUserById(userId);
    email = u?.user?.email || email;
  } else {
    const { data: byEmail } = await admin.rpc("get_auth_user_id_by_email", { _email: email });
    if (typeof byEmail === "string") userId = byEmail;
  }
  if (!userId) {
    password = randomPassword();
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: a.owner_name, phone: p10, signup_source: "whatsapp_agent", must_change_password: true },
    });
    if (error || !created?.user) throw new Error(`account: ${error?.message || "create failed"}`);
    userId = created.user.id;
  }
  const { data: prof } = await admin.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  if (prof) await admin.from("profiles").update({ phone: p10, phone_verified: true, full_name: a.owner_name }).eq("user_id", userId);
  else await admin.from("profiles").insert({ user_id: userId, phone: p10, phone_verified: true, full_name: a.owner_name });

  // 2) Act as the new owner so every step matches the web flow exactly.
  const session = await mintUserSession(admin, anon, userId, email, "wa-store-onboarding");
  if (!session) throw new Error("session mint failed");
  const auth = `Bearer ${session.access_token}`;
  const owner = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const fn = (name: string, body: unknown, ms = 20000) =>
    Promise.race([
      fetch(`${url}/functions/v1/${name}`, {
        method: "POST",
        headers: { Authorization: auth, apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => null) })),
      new Promise<{ ok: false; body: null }>((r) => setTimeout(() => r({ ok: false, body: null }), ms)),
    ]);

  // 3) Logo from WhatsApp → image CDN.
  let logoUrl: string | null = null;
  if (a.logo_media_id) {
    try {
      const meta = await fetch(`${GRAPH}/${a.logo_media_id}`, { headers: { Authorization: `Bearer ${ctx.token}` } }).then((r) => r.json());
      if (meta?.url && (meta.file_size ?? 0) <= 5 * 1024 * 1024) {
        const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${ctx.token}` } });
        const mime = meta.mime_type || bin.headers.get("content-type") || "image/jpeg";
        if (bin.ok && /^image\/(jpeg|png|webp)$/.test(mime)) {
          const ext = mime.split("/")[1].replace("jpeg", "jpg");
          const form = new FormData();
          form.append("file", new File([await bin.arrayBuffer()], `logo.${ext}`, { type: mime }));
          form.append("bucket", "store-logos");
          form.append("path", `${userId}/new-store/wa-logo-${Date.now()}.${ext}`);
          const up = await fetch(`${url}/functions/v1/r2-upload`, { method: "POST", headers: { Authorization: auth, apikey: anonKey }, body: form });
          const upBody = await up.json().catch(() => null);
          logoUrl = upBody?.publicUrl || null;
        }
      }
    } catch (e) { console.warn("[wa-onboard] logo failed", (e as Error).message); }
  }

  // 4) Store row (slug retry like the web flow).
  const storeName = String(a.brand);
  const sells = String(a.business_type || "");
  let slug = String(a.slug);
  let store: any = null;
  for (let attempt = 0; attempt < 5 && !store; attempt++) {
    const { data, error } = await owner.from("stores").insert({
      owner_id: userId, name: storeName, slug,
      description: a.description || null, business_type: sells || null,
      whatsapp_number: p10, currency: "INR", order_mode: "website",
      logo_url: logoUrl, theme: "theme-16", owner_name: a.owner_name || null,
      meta_title: `${storeName} — Shop Online`,
      meta_description: `Discover products at ${storeName}. Order online today.`,
    }).select("id, slug").single();
    if (!error) { store = data; break; }
    if (error.code !== "23505") throw new Error(`store: ${error.message}`);
    slug = `${String(a.slug)}${attempt + 1}`;
  }
  if (!store) throw new Error("store: slug unavailable");
  await saveSession(admin, phone, { store_id: store.id, user_id: userId });

  await owner.from("store_theme_config").insert({
    store_id: store.id, primary_color: "#1a1a1a", accent_color: "#f5f5f5", text_color: "#1a1a1a",
    background_color: "#ffffff", header_bg_color: "#ffffff", header_text_color: "#1a1a1a",
    heading_font: "Alegreya SC", body_font: "Alegreya SC", button_style: "rounded",
    product_card_style: "style-1", category_style: "style-1", header_style: "normal",
    header_logo_alignment: "Left", mobile_nav_enabled: true, marquee_enabled: false, marquee_text: "",
    marquee_gradient: "linear-gradient(90deg, #1a1a1a, #333333)",
  });

  // 5) AI copy with static fallback.
  const founder = String(a.owner_name || "");
  const sellsLine = sells && sells !== "Other" ? sells.toLowerCase() : "";
  let aboutUs = `About ${storeName}\n\n${founder ? `Founded by ${founder}\n\n` : ""}Welcome to ${storeName}! 🛍️ We sell ${sellsLine || "carefully curated products"} you can trust.\n\nEvery item is hand-picked so it meets our quality standards before it reaches you.\n\nWe keep shopping easy and affordable — clear pricing, fast delivery and friendly support at every step.\n\nThank you for choosing ${storeName}. ❤️`;
  let metaTitle = `${storeName}${sellsLine ? ` — ${sells}` : " — Shop Online"}`.substring(0, 60);
  let metaDescription = `Shop ${sellsLine || "the best products"} at ${storeName}. Quality items, fast delivery and great prices. Order now!`.substring(0, 150);
  let storeDescription = a.description || `${storeName} — ${sellsLine ? `${sells}.` : "quality products."} Shop now for the best deals!`;
  const gen = await fn("generate-store-content", {
    store_name: storeName, store_description: a.description || "", business_type: sells, owner_name: founder,
  }, 12000);
  if (gen.ok && gen.body) {
    const g = gen.body;
    if (g.about_us) aboutUs = `About ${storeName}\n\n${founder ? `Founded by ${founder}\n\n` : ""}${g.about_us}`;
    if (g.meta_title) metaTitle = String(g.meta_title).substring(0, 60);
    if (g.meta_description) metaDescription = String(g.meta_description).substring(0, 150);
    if (g.store_description) storeDescription = String(g.store_description).substring(0, 500);
  }
  await owner.from("stores").update({
    meta_title: metaTitle, meta_description: metaDescription, about_us_text: aboutUs, description: storeDescription,
  }).eq("id", store.id);
  await owner.from("store_pages").insert({
    store_id: store.id, title: "About Us", slug: "about-us", page_type: "about",
    content: aboutUs, is_active: true, display_order: 0,
  });

  // 6) Catalog: import from old website, else demo products.
  let importing = false;
  if (a.website) {
    const det = await fn("migration-detect", { platform: "auto", source_url: a.website });
    if (det.ok && det.body && !det.body.error) {
      const st = await fn("migration-start", {
        store_id: store.id, platform: det.body.import_platform || "generic",
        detected_platform: det.body.platform || "generic", source_url: a.website,
        discovered_counts: det.body.counts || {}, credentials: {}, entities: ["products", "categories", "pages"],
      });
      importing = st.ok && !st.body?.error;
    }
  }
  if (!importing) await fn("seed-demo-store", { store_id: store.id }, 30000);
  await fn("prewarm-store", { slug: store.slug }, 8000);

  // 7) Credentials.
  const link = await magicLink(admin, email);
  await saveSession(admin, phone, { status: "done", step: "done", last_error: null });
  await text(ctx, phone,
    `🎉 *Your store is ready!*\n\n🛍️ Store: https://${store.slug}.shopbanao.in\n` +
    `⚙️ Admin: https://shopbanao.in/login\n` +
    `👤 Login ID: *${p10}*\n` +
    (password ? `🔑 Password: *${password}*\n_(please change it in Settings after logging in)_\n` : `🔑 Use your existing password or log in with your mobile number.\n`) +
    (link ? `\n🔐 One-tap login (valid 1 hour):\n${link}\n` : "") +
    (importing
      ? `\n📦 We're copying products from ${a.website} — they'll appear in your dashboard as drafts for you to review.`
      : `\n📦 We added a few demo products — replace them with your own from the dashboard.`) +
    `\n\nNeed help? Just reply here.`);
}
