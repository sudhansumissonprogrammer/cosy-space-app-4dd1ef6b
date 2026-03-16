import { useMemo } from "react";
import { Link, useOutletContext, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import { storefrontPath } from "@/lib/subdomain";

export default function CategoryDetail() {
  const store = useOutletContext<StoreData>();
  const { slug, categorySlug } = useParams<{ slug: string; categorySlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const themeConfig = queryClient.getQueryData<any>(["storefront-theme-config", store.id]);
  const cardStyle = themeConfig?.product_card_style || "style-1";

  const { data: category, isLoading: categoryLoading } = useQuery({
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

  const { data: products, isLoading: productsLoading } = useQuery({
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

  if (!categoryLoading && !category) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Button variant="outline" size="sm" onClick={() => navigate(storefrontPath(slug!, ""))} className="mb-4 rounded-full bg-background text-foreground shadow-sm hover:shadow-md">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
          <p className="text-muted-foreground">Category not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Button variant="outline" size="sm" onClick={() => navigate(storefrontPath(slug!, ""))} className="mb-4 rounded-full bg-background text-foreground shadow-sm hover:shadow-md">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
      </Button>

      {categoryLoading || productsLoading || !products ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
              <div className="px-2.5 pb-2.5 pt-2 space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <>
          <p className="mb-5 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, idx) => (
              <UniversalProductCard
                key={product.id}
                product={product}
                slug={slug!}
                store={store}
                priority={idx < 4}
                cardStyle={cardStyle}
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
  );
}
