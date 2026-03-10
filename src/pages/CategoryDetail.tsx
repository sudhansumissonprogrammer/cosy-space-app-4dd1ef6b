import { useMemo } from "react";
import { Link, useOutletContext, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import { storefrontPath } from "@/lib/subdomain";

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
      {/* Products Grid */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Floating Back Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(storefrontPath(slug!, ""))}
          className="mb-4 rounded-full bg-background text-foreground shadow-sm hover:shadow-md"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back
        </Button>

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
                  store={store}
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
