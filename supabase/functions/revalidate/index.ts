/**
 * revalidate: Purge cached pages for a specific store.
 *
 * Called when store data changes (product update, settings change, etc.)
 * to trigger re-rendering of affected pages.
 *
 * Query params:
 *  - slug: store slug (required)
 *  - path: specific path to invalidate (optional, defaults to all)
 *  - secret: revalidation secret for auth
 *
 * Usage:
 *  /revalidate?slug=my-store                  → purge all pages
 *  /revalidate?slug=my-store&path=/product/x  → purge specific page
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const path = url.searchParams.get("path");

  if (!slug) {
    return new Response(
      JSON.stringify({ error: "Missing slug parameter" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Verify the caller is the store owner
  const authHeader = req.headers.get("authorization");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let authorized = false;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // Allow service role or anon key (from Cloudflare Worker)
    if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      authorized = true;
    } else {
      // Verify JWT and check store ownership
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        anonKey,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
        },
      );
      const {
        data: { user },
      } = await userClient.auth.getUser();
      if (user) {
        const { data: store } = await supabase
          .from("stores")
          .select("id")
          .eq("slug", slug)
          .eq("owner_id", user.id)
          .single();
        if (store) authorized = true;
      }
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build list of paths to invalidate
  const pathsToInvalidate: string[] = [];
  if (path) {
    pathsToInvalidate.push(path);
  } else {
    // Invalidate common pages
    pathsToInvalidate.push("/", "/best-sellers", "/contact");
    // Fetch product slugs to invalidate product pages
    const { data: products } = await supabase
      .from("products")
      .select("slug")
      .eq(
        "store_id",
        (
          await supabase
            .from("stores")
            .select("id")
            .eq("slug", slug)
            .single()
        ).data?.id || "",
      )
      .eq("is_active", true)
      .limit(200);

    if (products) {
      for (const p of products) {
        if (p.slug) pathsToInvalidate.push(`/product/${p.slug}`);
      }
    }

    // Fetch categories
    const { data: storeData } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", slug)
      .single();

    if (storeData) {
      const { data: categories } = await supabase
        .from("categories")
        .select("slug")
        .eq("store_id", storeData.id);

      if (categories) {
        for (const c of categories) {
          pathsToInvalidate.push(`/category/${c.slug}`);
        }
      }
    }
  }

  // Return the invalidation manifest for the Cloudflare Worker to purge
  // The Worker will use this to purge its Cache API entries
  const result = {
    slug,
    paths: pathsToInvalidate,
    invalidated_at: new Date().toISOString(),
    count: pathsToInvalidate.length,
  };

  return new Response(JSON.stringify(result), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
});
