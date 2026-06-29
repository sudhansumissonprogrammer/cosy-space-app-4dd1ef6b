// Admin tool: takes a brief like "Diwali sale 15% off jewellery store" and
// returns a structured WhatsApp template draft via Lovable AI Gateway.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM = `You are a WhatsApp Business template author for an Indian D2C ecommerce SaaS named ShopBanao.
Generate ONE template draft. Requirements:
- Body 80–250 chars, friendly tone, optional 1–2 emojis.
- Use {{1}}..{{n}} numbered placeholders only.
- Provide a snake_case template_name suffixed _v1.
- Variables list maps each placeholder to a semantic key (customer_name, store_name, discount_pct, coupon_code, shop_url, etc).
- Return STRICT JSON matching the schema. No prose.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: { brief: string; category?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body.brief?.trim()) return json({ error: "brief required" }, 400);

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Brief: ${body.brief}\nCategory: ${body.category || "marketing"}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "emit_template",
          description: "Emit the drafted WhatsApp template",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              template_name: { type: "string" },
              headline: { type: "string" },
              body: { type: "string" },
              button_label: { type: "string" },
              emoji_set: { type: "array", items: { type: "string" } },
              coupon_code: { type: "string" },
              variables: { type: "array", items: { type: "string" } },
              category: { type: "string", enum: ["marketing", "transactional", "utility"] },
            },
            required: ["template_name", "body", "variables", "category"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "emit_template" } },
    }),
  });

  if (r.status === 429) return json({ error: "rate_limited" }, 429);
  if (r.status === 402) return json({ error: "credits_exhausted" }, 402);
  if (!r.ok) {
    const t = await r.text();
    return json({ error: "ai_failed", details: t }, 502);
  }
  const j = await r.json();
  const call = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!call) return json({ error: "no_output" }, 502);
  let draft: any;
  try { draft = JSON.parse(call); } catch { return json({ error: "bad_output" }, 502); }
  return json({ draft });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
