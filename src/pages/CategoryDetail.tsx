import { useMemo } from "react";
import { Link, useOutletContext, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";

export default function CategoryDetail() {
  const store = useOutletContext<StoreData>();
  const { slug, categorySlug } = useParams<{ slug: string; categorySlug: string }>();
  const navigate = useNavigate();

  const { data: category } = useQuery({
    queryKey: ["category", store.id, categorySlug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .eq("store_id", store.id)
        .eq("slug", categorySlug)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; slug: string; image_url: string | null } | null;
    },
    enabled: !!store.id && !!categorySlug,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["category-products", store.id, category?.name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", store.id)
        .eq("category", category!.name)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!store.id && !!category?.name,
  });

  if (!category && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Category not found</p>
      </div>
    );
  }

  return (
    <>
      {/* Fixed Header with Back Button */}
      <div className="sticky top-14 z-20 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/store/${slug}`)}
            className="h-9 w-9 flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-lg font-semibold text-foreground">
            {category?.name || "Category"}
          </h1>
        </div>
      </div>

      {/* Products Grid */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : products && products.length > 0 ? (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              {products.length} {products.length === 1 ? "product" : "products"}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <StorefrontProductCard
                  key={product.id}
                  product={product}
                  slug={slug!}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
            <p className="text-muted-foreground">No products in this category yet.</p>
          </div>
        )}
      </div>
    </>
  );
}
