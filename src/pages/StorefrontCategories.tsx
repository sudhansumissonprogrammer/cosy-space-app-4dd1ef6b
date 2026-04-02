import { useOutletContext } from "react-router-dom";
import { Link } from "react-router-dom";
import { Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { Skeleton } from "@/components/ui/skeleton";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function StorefrontCategories() {
  const store = useOutletContext<StoreData>();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["storefront-categories", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, image_url")
        .eq("store_id", store.id)
        .order("display_order" as any)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-bold text-foreground mb-5">All Categories</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: "1/1" }} />
              <Skeleton className="h-4 w-20 mt-2 mx-auto" />
            </div>
          ))}
        </div>
      ) : !categories || categories.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">No categories found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={storefrontPath(store.slug, `category/${cat.slug}`)}
              className="group"
            >
              <div
                className="w-full rounded-2xl overflow-hidden border border-border bg-secondary/20 transition-all group-hover:shadow-lg group-hover:border-transparent"
                style={{ aspectRatio: "1/1" }}
              >
                {cat.image_url ? (
                  <img
                    src={optimizeImageUrl(cat.image_url, 400, 85)}
                    alt={cat.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    width={300}
                    height={300}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-accent">
                    <Tag className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-foreground text-center truncate">
                {cat.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
