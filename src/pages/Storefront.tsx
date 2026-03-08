import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Store } from "lucide-react";

export default function Storefront() {
  const { slug } = useParams<{ slug: string }>();

  const { data: store, isLoading, error } = useQuery({
    queryKey: ["storefront", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: products } = useQuery({
    queryKey: ["storefront-products", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", store!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!store?.id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Store not found</h1>
        <p className="text-muted-foreground">The store "{slug}" doesn't exist.</p>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      {store.banner_url ? (
        <div className="h-48 w-full sm:h-64">
          <img src={store.banner_url} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-48 w-full bg-accent sm:h-64" />
      )}

      {/* Store Header */}
      <div className="mx-auto max-w-5xl px-4">
        <div className="-mt-12 flex items-end gap-4 sm:-mt-16">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-24 w-24 rounded-xl border-4 border-background object-cover shadow-md sm:h-32 sm:w-32"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl border-4 border-background bg-card shadow-md sm:h-32 sm:w-32">
              <Store className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div className="mb-2 flex-1">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{store.name}</h1>
            {store.description && (
              <p className="mt-1 text-sm text-muted-foreground">{store.description}</p>
            )}
          </div>
          {store.whatsapp_number && (
            <Button asChild className="mb-2">
              <a
                href={`https://wa.me/${encodeURIComponent(store.whatsapp_number.replace(/[^0-9+]/g, ""))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          )}
        </div>

        {/* Products */}
        <div className="mt-8 pb-12">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Products</h2>
          {products && products.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  {product.image_url && (
                    <div className="aspect-square w-full">
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-medium text-foreground">{product.name}</h3>
                    {product.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                    )}
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {product.currency} {Number(product.price).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex min-h-[200px] items-center justify-center">
                <p className="text-muted-foreground">No products available yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
