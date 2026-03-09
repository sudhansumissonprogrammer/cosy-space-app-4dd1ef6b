import { useState, useMemo } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Store, Package, Search, MapPin, Clock, BadgeCheck, Instagram, Facebook, Tag, Heart, ShoppingCart, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontHero from "@/components/storefront/StorefrontHero";
import StorefrontCategories from "@/components/storefront/StorefrontCategories";
import StorefrontProductCard from "@/components/storefront/StorefrontProductCard";
import StorefrontAbout from "@/components/storefront/StorefrontAbout";

export default function StorefrontHome() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products, isLoading } = useQuery({
    queryKey: ["storefront-products", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: storeCategories } = useQuery({
    queryKey: ["storefront-categories", store.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .eq("store_id", store.id)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; slug: string; image_url: string | null }[];
    },
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [products, searchQuery]);

  return (
    <>
      {/* Search under header */}
      <div className="border-b bg-card px-4 py-3">
        <div className="mx-auto max-w-6xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              maxLength={100}
            />
          </div>
        </div>
      </div>

      <StorefrontCategories
        categories={storeCategories}
        storeSlug={slug!}
      />

      <div className="mx-auto max-w-6xl px-4 py-6">

        {/* Product Grid */}
        <section>
          <h2 className="mb-5 text-xl font-bold text-foreground">
            Popular Products
            {filteredProducts.length !== (products?.length || 0) && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredProducts.length} of {products?.length})
              </span>
            )}
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <StorefrontProductCard
                  key={product.id}
                  product={product}
                  slug={slug!}
                  store={store}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
              <p className="text-muted-foreground">
                {searchQuery ? "No products match your search." : "No products available yet."}
              </p>
            </div>
          )}
        </section>

        <StorefrontAbout store={store} productCount={products?.length || 0} />
      </div>
    </>
  );
}
