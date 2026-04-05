import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, store_id, template_name, template_category, template_body, template_language, template_id } = body;

    if (!store_id) {
      return new Response(JSON.stringify({ error: "store_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get store's WhatsApp config
    const { data: config, error: configErr } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("store_id", store_id)
      .maybeSingle();

    const marketingMode = (config as any)?.marketing_mode || "shopbanao";
    let waba_id = (config as any)?.waba_id;
    let access_token = (config as any)?.access_token;

    // For shopbanao mode or missing own credentials, fall back to platform config
    if (!waba_id || !access_token || marketingMode === "shopbanao") {
      const { data: platformConfig } = await supabase
        .from("platform_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (platformConfig) {
        // platform_config doesn't have waba_id column, so we check if store has it
        // For shopbanao mode, use platform access_token but still need waba_id somewhere
        access_token = (platformConfig as any).wa_access_token || access_token;
      }
    }

    if (!waba_id) {
      return new Response(
        JSON.stringify({ error: "WABA ID is required for template management. Please add it in your WhatsApp Setup tab." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!access_token) {
      return new Response(
        JSON.stringify({ error: "Access token is missing. Please configure WhatsApp in Setup." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── SYNC: Fetch all templates from Meta ───
    if (action === "sync") {
      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${waba_id}/message_templates?limit=250`,
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );
      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch templates from Meta", details: metaData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const templates = metaData.data || [];
      
      // Upsert each template into our DB
      for (const t of templates) {
        const bodyComponent = t.components?.find((c: any) => c.type === "BODY");
        const bodyText = bodyComponent?.text || "";

        await adminClient
          .from("whatsapp_templates")
          .upsert(
            {
              store_id,
              template_name: t.name,
              template_type: "meta_synced",
              body_text: bodyText,
              language_code: t.language || "en",
              meta_status: t.status, // APPROVED, PENDING, REJECTED
              meta_template_id: t.id,
              meta_category: t.category || "MARKETING",
              meta_rejected_reason: t.rejected_reason || null,
              is_active: t.status === "APPROVED",
            },
            { onConflict: "store_id,template_name" }
          );
      }

      return new Response(
        JSON.stringify({ success: true, count: templates.length, templates }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── SUBMIT: Create a new template on Meta ───
    if (action === "submit") {
      if (!template_name || !template_body) {
        return new Response(
          JSON.stringify({ error: "template_name and template_body are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Template name must be lowercase, alphanumeric, underscores only
      const sanitizedName = template_name
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");

      const metaPayload: any = {
        name: sanitizedName,
        language: template_language || "en",
        category: template_category || "MARKETING",
        components: [
          {
            type: "BODY",
            text: template_body,
          },
        ],
      };

      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${waba_id}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaPayload),
        }
      );

      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        return new Response(
          JSON.stringify({ error: "Meta rejected template submission", details: metaData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save to our DB
      await adminClient.from("whatsapp_templates").upsert(
        {
          store_id,
          template_name: sanitizedName,
          template_type: "meta_synced",
          body_text: template_body,
          language_code: template_language || "en",
          meta_status: metaData.status || "PENDING",
          meta_template_id: metaData.id,
          meta_category: template_category || "MARKETING",
          is_active: false,
        },
        { onConflict: "store_id,template_name" }
      );

      return new Response(
        JSON.stringify({ success: true, template_id: metaData.id, status: metaData.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── DELETE: Remove a template from Meta ───
    if (action === "delete") {
      if (!template_name) {
        return new Response(
          JSON.stringify({ error: "template_name required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${waba_id}/message_templates?name=${template_name}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      const metaData = await metaRes.json();

      // Also delete from our DB
      await adminClient
        .from("whatsapp_templates")
        .delete()
        .eq("store_id", store_id)
        .eq("template_name", template_name);

      return new Response(
        JSON.stringify({ success: metaRes.ok, details: metaData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: sync, submit, delete" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Template API error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
