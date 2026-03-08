import { useEffect } from "react";
import { useParams, Link, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Store } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useMetaTags } from "@/hooks/useMetaTags";

export type StoreData = Tables<"stores">;

export function useStorefront() {
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

  return { store, isLoading, error, slug };
}

export default function StorefrontLayout() {
  const { store, isLoading, slug } = useStorefront();

  useMetaTags({
    title: store ? `${store.name} — Store` : undefined,
    description: store?.description || undefined,
    ogImage: store?.logo_url || undefined,
  });

  // Track page view
  useEffect(() => {
    if (!store?.id) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;
    fetch(`https://${projectId}.supabase.co/functions/v1/track-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_id: store.id, path: window.location.pathname }),
    }).catch(() => {}); // fire and forget
  }, [store?.id]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
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
      {/* Sticky Nav */}
      <nav className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to={`/store/${store.slug}`} className="flex-shrink-0">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-10 w-auto max-w-[140px] object-contain sm:h-10" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Store className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
          </Link>
          <div className="flex-1" />
          <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
        </div>
      </nav>

      <Outlet context={store} />
    </div>
  );
}
