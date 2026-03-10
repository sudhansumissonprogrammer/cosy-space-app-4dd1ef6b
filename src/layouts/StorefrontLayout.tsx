import { useEffect, useState } from "react";
import { useParams, Link, Outlet } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Store, ShoppingCart, Home, Tag, Mail, Heart, RotateCcw, Truck, FileText, Shield, User } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useMetaTags } from "@/hooks/useMetaTags";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { WishlistProvider, useWishlist } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider, useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import FloatingWhatsApp from "@/components/storefront/FloatingWhatsApp";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import SideCart from "@/components/storefront/SideCart";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";

export type StoreData = Tables<"stores">;

export function useStorefront(slugOverride?: string) {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride || paramSlug;

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
    staleTime: 5 * 60 * 1000,
  });

  return { store, isLoading, error, slug };
}

function CartBadge() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative">
      <div className="flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent transition-colors">
        <ShoppingCart className="h-5 w-5" />
      </div>
      {cartCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadge({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative">
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Heart className="h-5 w-5" />
      </Button>
      {wishlistCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {wishlistCount > 99 ? "99+" : wishlistCount}
        </span>
      )}
    </Link>
  );
}

function AccountBadge({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")}>
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <User className="h-5 w-5" />
      </Button>
    </Link>
  );
}

function HamburgerMenu({ store }: { store: StoreData }) {
  const [open, setOpen] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["storefront-categories-menu", store.id],
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 p-0">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="7" x2="18" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="6" y1="17" x2="18" y2="17" />
          </svg>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <div className="flex flex-col">
          <div className="border-b bg-card p-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-10 w-auto max-w-[160px] object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                  <Store className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">{store.name}</span>
              </div>
            )}
          </div>
          <nav className="flex flex-col gap-1 p-4">
            <Link
              to={storefrontPath(store.slug)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link
              to={storefrontPath(store.slug, "wishlist")}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Heart className="h-4 w-4" />
              Wishlist
            </Link>
            <Link
              to={storefrontPath(store.slug, "contact")}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Mail className="h-4 w-4" />
              Contact Us
            </Link>
            <Link
              to={storefrontPath(store.slug, "return-policy")}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <RotateCcw className="h-4 w-4" />
              Return, Refund & Cancellation
            </Link>
            {categories && categories.length > 0 && (
              <>
                <div className="mt-3 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Categories
                </div>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={storefrontPath(store.slug, `category/${cat.slug}`)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <Tag className="h-4 w-4" />
                    {cat.name}
                  </Link>
                ))}
              </>
            )}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Skeleton shell shown instantly while store data loads */
function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Marquee placeholder */}
      <div className="h-8 bg-muted/50" />
      {/* Nav skeleton */}
      <nav className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <div className="flex-1" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </nav>
      {/* Search bar skeleton */}
      <div className="border-b bg-card px-4 py-3">
        <div className="mx-auto max-w-6xl">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
      {/* Category pills skeleton */}
      <div className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-6xl gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-20 flex-shrink-0 rounded-full" />
          ))}
        </div>
      </div>
      {/* Product grid skeleton */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Skeleton className="mb-5 h-7 w-40" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
              <div className="px-2.5 pb-2.5 pt-2 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StorefrontLayout({ slugOverride }: { slugOverride?: string } = {}) {
  const { store, isLoading, slug } = useStorefront(slugOverride);
  const queryClient = useQueryClient();

  // Prefetch products & categories as soon as store.id is available
  // so data is cached before StorefrontHome mounts
  useEffect(() => {
    if (!store?.id) return;
    const storeId = store.id;

    // Use RPC to fetch everything in one call, then seed individual caches
    queryClient.prefetchQuery({
      queryKey: ["storefront-bulk", storeId],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("get_storefront_data", { _slug: store.slug });
        if (error) throw error;
        const result = data as any;
        // Seed individual caches so StorefrontHome reads them instantly
        if (result.products) {
          queryClient.setQueryData(["storefront-products", storeId], result.products);
        }
        if (result.categories) {
          queryClient.setQueryData(["storefront-categories", storeId], result.categories);
        }
        return result;
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [store?.id, queryClient, store?.slug]);

  useFacebookPixel((store as any)?.facebook_pixel_id);

  useMetaTags({
    title: store ? `${store.name} — Store` : undefined,
    description: store?.description || undefined,
    ogImage: store?.logo_url || undefined,
    storeSlug: store?.slug,
  });

  // Track page view
  useEffect(() => {
    if (!store?.id) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;
    const timer = setTimeout(() => {
      fetch(`https://${projectId}.supabase.co/functions/v1/track-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: store.id, path: window.location.pathname }),
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [store?.id]);

  if (isLoading) {
    return <StorefrontSkeleton />;
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
    <CartProvider slug={store.slug}>
      <WishlistProvider slug={store.slug}>
        <StorefrontAuthProvider storeId={store.id}>
          <div className="min-h-screen bg-background font-sans" style={{ fontVariant: "small-caps" }}>
            {/* Marquee Banner */}
            <StorefrontMarquee />
            
            {/* Sticky Nav */}
            <nav className="sticky top-0 z-30 bg-card/80 backdrop-blur-md">
              <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
                <HamburgerMenu store={store} />
                <Link to={storefrontPath(store.slug)} className="flex-shrink-0">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt={store.name} className="h-12 w-auto max-w-[160px] object-contain" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                      <Store className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                </Link>
                <div className="flex-1" />
                <AccountBadge slug={store.slug} />
                <WishlistBadge slug={store.slug} />
                <CartBadge />
                <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
              </div>
            </nav>

            <Outlet context={store} />
            <StorefrontFooter store={store} />
            <SideCart store={store} />
            <FloatingWhatsApp store={store} />
          </div>
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
