import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Store, Package } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function StorefrontHome() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();

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

  const categories = [...new Set(products?.map((p) => p.category).filter(Boolean))] as string[];

  return (
    <>
      {/* Hero Banner */}
      <section className="relative">
        {store.banner_url ? (
          <div className="h-64 w-full sm:h-80 lg:h-96">
            <img src={store.banner_url} alt="" className="h-full w-full object-cover" />
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
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-background bg-card shadow-lg sm:h-28 sm:w-28">
                  <Store className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="mb-1 min-w-0 flex-1">
                <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{store.name}</h1>
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
        {/* Category Badges */}
        {categories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Badge key={cat} variant="secondary" className="text-xs">
                {cat}
              </Badge>
            ))}
          </div>
        )}

        {/* Product Grid */}
        <section>
          <h2 className="mb-6 text-xl font-semibold text-foreground">Products</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
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
                              ${Number(product.sale_price).toFixed(2)}
                            </span>
                            <span className="text-sm text-muted-foreground line-through">
                              ${Number(product.price).toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-bold text-foreground">
                            ${Number(product.price).toFixed(2)}
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
                <p className="text-muted-foreground">No products available yet.</p>
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
