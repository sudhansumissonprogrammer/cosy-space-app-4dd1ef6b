import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_store",
  title: "Get store details",
  description:
    "Fetch a single published ShopBanao storefront by its slug. Returns public store info (name, description, contact, logo, theme).",
  inputSchema: {
    slug: z.string().trim().min(1).describe("Store slug, e.g. 'serdiyajewellers'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("stores")
      .select(
        "slug, name, description, logo_url, banner_url, whatsapp_number, contact_email, theme, is_published",
      )
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: `No published store with slug "${slug}".` }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { store: data },
    };
  },
});
