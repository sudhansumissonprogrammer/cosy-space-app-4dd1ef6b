import { useState, useMemo } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageCircle, Store, Package, Search, MapPin, Clock, BadgeCheck, Instagram, Facebook, Tag } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function StorefrontHome() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !activeCategory || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, activeCategory]);

  return (
    <>
      {/* Hero Banner */}
      <section className="relative">
        {store.banner_url ? (
          <div className="h-64 w-full sm:h-80 lg:h-96">
            <img src={store.banner_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-64 w-full bg-gradient-to-br from-primary/20 via-accent to-primary/10 sm:h-80 lg:h-96">
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        )}
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-4 pb-8">
            <div className="flex items-end gap-4">
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="h-20 w-20 rounded-2xl border-4 border-background object-cover shadow-lg sm:h-28 sm:w-28"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-background bg-card shadow-lg sm:h-28 sm:w-28">
                  <Store className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="mb-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{store.name}</h1>
                  {(store as any).is_verified && (
                    <BadgeCheck className="h-6 w-6 text-primary" />
                  )}
                </div>
                {store.description && (
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-base">
                    {store.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Search & Filter */}
        <div className="mb-6 space-y-4">
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
          {storeCategories && storeCategories.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setActiveCategory(null)}
                className={`flex flex-col items-center gap-1.5 flex-shrink-0 transition-opacity ${activeCategory === null ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
              >
                <div className={`flex h-16 w-16 items-center justify-center rounded-full border-2 ${activeCategory === null ? "border-primary bg-primary/10" : "border-border bg-accent"}`}>
                  <Tag className="h-5 w-5 text-foreground" />
                </div>
                <span className="text-xs font-medium text-foreground max-w-[72px] truncate">All</span>
              </button>
              {storeCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                  className={`flex flex-col items-center gap-1.5 flex-shrink-0 transition-opacity ${activeCategory === cat.name ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
                >
                  <div className={`h-16 w-16 rounded-full border-2 overflow-hidden ${activeCategory === cat.name ? "border-primary" : "border-border"}`}>
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-accent">
                        <Tag className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium text-foreground max-w-[72px] truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <section>
          <h2 className="mb-6 text-xl font-semibold text-foreground">
            Products
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/store/${slug}/product/${product.slug || product.id}`}
                  className="group"
                >
                  <Card className="overflow-hidden transition-shadow hover:shadow-md">
                    <div className="aspect-square w-full overflow-hidden bg-accent">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      {product.category && (
                        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {product.category}
                        </p>
                      )}
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      <div className="mt-2 flex items-center gap-2">
                        {product.sale_price ? (
                          <>
                            <span className="text-lg font-bold text-foreground">
                              {product.currency} {Number(product.sale_price).toFixed(2)}
                            </span>
                            <span className="text-sm text-muted-foreground line-through">
                              {product.currency} {Number(product.price).toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-bold text-foreground">
                            {product.currency} {Number(product.price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex min-h-[200px] items-center justify-center">
                <p className="text-muted-foreground">
                  {searchQuery || activeCategory ? "No products match your search." : "No products available yet."}
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* About Store Section */}
        <section className="mt-16 border-t pt-10">
          <h2 className="mb-4 text-xl font-semibold text-foreground">About {store.name}</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              {store.description ? (
                <p className="leading-relaxed text-muted-foreground">{store.description}</p>
              ) : (
                <p className="text-muted-foreground">Welcome to our store!</p>
              )}
            </div>
            <div className="space-y-3">
              {(store as any).location && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {(store as any).location}
                </p>
              )}
              {(store as any).business_hours && (
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Clock className="h-4 w-4" /> Business Hours
                  </p>
                  {Object.entries((store as any).business_hours as Record<string, string>).map(([day, hours]) => (
                    hours ? (
                      <p key={day} className="ml-6 text-sm text-muted-foreground">
                        <span className="inline-block w-10 capitalize">{day}</span> {hours}
                      </p>
                    ) : null
                  ))}
                </div>
              )}
              {store.whatsapp_number && (
                <a
                  href={`https://wa.me/${encodeURIComponent(store.whatsapp_number.replace(/[^0-9+]/g, ""))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <MessageCircle className="h-4 w-4" />
                  Contact us on WhatsApp
                </a>
              )}
              {(store as any).instagram_url && (
                <a href={(store as any).instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                  <Instagram className="h-4 w-4" /> Instagram
                </a>
              )}
              {(store as any).facebook_url && (
                <a href={(store as any).facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                  <Facebook className="h-4 w-4" /> Facebook
                </a>
              )}
              {products && (
                <p className="text-sm text-muted-foreground">
                  {products.length} product{products.length !== 1 ? "s" : ""} available
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
