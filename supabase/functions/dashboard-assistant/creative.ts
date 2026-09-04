// AI product-image studio tool for the Store Assistant.
//
// The assistant does not generate the image itself inside the chat request
// (generation takes 15-60s). Instead it opens an in-chat Image Studio card
// pre-filled with the product(s) the merchant meant. The card then calls the
// `assistant-image-studio` edge function to browse, generate and attach.
//
// Read-only here: this only resolves what the merchant is talking about.

export const CREATIVE_TOOLS = [
  {
    type: "function",
    function: {
      name: "open_image_studio",
      description:
        "Open the AI product image studio inside the chat so the merchant can pick a product, pick a source photo, choose a style and generate a marketing/campaign image — and optionally add it to the product page. Call this whenever the merchant asks to generate, create, design, restyle, enhance or make an image, poster, banner, ad creative, campaign post or product photo.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Product name or words the merchant used to describe the product, if any.",
          },
          category: {
            type: "string",
            description: "Category name the merchant mentioned, if any.",
          },
          brief: {
            type: "string",
            description:
              "What the merchant wants the image to look like, in their own words (e.g. 'Diwali sale post', 'clean white background').",
          },
          preset: {
            type: "string",
            enum: ["clean_white", "festive_offer", "lifestyle", "luxury_dark", "model_ready", "banner_wide"],
            description: "Best matching style preset for the request.",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

export type StudioCard = {
  type: "image_studio";
  brief: string;
  preset: string;
  category_id: string | null;
  category_name: string | null;
  product_id: string | null;
  products: Array<{ id: string; name: string; image_url: string | null }>;
};

export async function runCreativeTool(
  admin: any,
  storeId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: unknown; card: StudioCard } | null> {
  if (name !== "open_image_studio") return null;

  const query = (args?.query ?? "").toString().trim();
  const categoryName = (args?.category ?? "").toString().trim();
  const brief = (args?.brief ?? "").toString().slice(0, 400);
  const preset = (args?.preset ?? "").toString() || "clean_white";

  let categoryId: string | null = null;
  let resolvedCategory: string | null = null;
  if (categoryName) {
    const { data: cat } = await admin
      .from("categories")
      .select("id, name")
      .eq("store_id", storeId)
      .ilike("name", `%${categoryName}%`)
      .limit(1)
      .maybeSingle();
    if (cat) {
      categoryId = cat.id;
      resolvedCategory = cat.name;
    }
  }

  let ids: string[] | null = null;
  if (categoryId) {
    const { data: links } = await admin
      .from("product_categories")
      .select("product_id")
      .eq("store_id", storeId)
      .eq("category_id", categoryId)
      .limit(300);
    ids = (links ?? []).map((l: any) => l.product_id);
  }

  let q = admin
    .from("products")
    .select("id, name, image_url")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (ids && ids.length) q = q.in("id", ids);
  if (query) q = q.ilike("name", `%${query}%`);
  let { data: products } = await q;

  // Nothing matched the search term — fall back to the latest products so the
  // merchant can still pick from the grid instead of hitting a dead end.
  if ((!products || products.length === 0) && query) {
    const { data: latest } = await admin
      .from("products")
      .select("id, name, image_url")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(12);
    products = latest ?? [];
  }

  const list = (products ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    image_url: p.image_url ?? null,
  }));

  const card: StudioCard = {
    type: "image_studio",
    brief,
    preset,
    category_id: categoryId,
    category_name: resolvedCategory,
    product_id: list.length === 1 ? list[0].id : null,
    products: list,
  };

  return {
    result: {
      opened: true,
      matched_products: list.length,
      exact_match: list.length === 1 ? list[0].name : null,
      category: resolvedCategory,
      note:
        list.length === 0
          ? "This store has no products yet — the merchant must add a product with a photo first."
          : "The Image Studio card is now open in the chat. Tell the merchant to pick the product and tap Generate.",
    },
    card,
  };
}
