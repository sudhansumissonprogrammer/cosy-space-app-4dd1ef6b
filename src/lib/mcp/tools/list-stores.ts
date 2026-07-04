import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_stores",
  title: "List public stores",
  description:
    "List published storefronts on ShopBanao. Returns store slug, name, description, and logo. Use search to filter by name/slug.",
  inputSchema: {
    search: z.string().trim().optional().describe("Optional case-insensitive substring to match on name or slug."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = supabase
      .from("stores")
      .select("slug, name, description, logo_url")
      .eq("is_published", true)
      .limit(limit ?? 20);
    if (search) q = q.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { stores: data ?? [] },
    };
  },
});
