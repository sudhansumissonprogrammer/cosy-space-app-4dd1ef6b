import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_products",
  title: "List store products",
  description:
    "List active products for a ShopBanao store by slug. Optional search filters by product name.",
  inputSchema: {
    slug: z.string().trim().min(1).describe("Store slug the products belong to."),
    search: z.string().trim().optional().describe("Optional case-insensitive substring match on product name."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug, search, limit }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: store, error: sErr } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", slug)
      .eq("is_suspended", false)
      .maybeSingle();
    if (sErr) return { content: [{ type: "text", text: sErr.message }], isError: true };
    if (!store) return { content: [{ type: "text", text: `No active store with slug "${slug}".` }], isError: true };

    let q = supabase
      .from("products")
      .select("id, name, slug, description, price, sale_price, currency, stock_quantity, image_url, category")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(limit ?? 20);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
