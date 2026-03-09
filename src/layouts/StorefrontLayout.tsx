import { useEffect, useState } from "react";
import { useParams, Link, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Store, ShoppingCart, Home, Tag, Mail, Heart } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useMetaTags } from "@/hooks/useMetaTags";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { WishlistProvider, useWishlist } from "@/contexts/WishlistContext";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";

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

function CartBadge({ slug }: { slug: string }) {
  const { cartCount } = useCart();
  return (
    <Link to={`/store/${slug}/cart`} className="relative">
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <ShoppingCart className="h-5 w-5" />
      </Button>
      {cartCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </Link>
  );
}

function WishlistBadge({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={`/store/${slug}/wishlist`} className="relative">
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
            <h2 className="text-lg font-semibold text-foreground">Menu</h2>
          </div>
          <nav className="flex flex-col gap-1 p-4">
            <Link
              to={`/store/${store.slug}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link
              to={`/store/${store.slug}/wishlist`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Heart className="h-4 w-4" />
              Wishlist
            </Link>
            <Link
              to={`/store/${store.slug}/contact`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Mail className="h-4 w-4" />
              Contact Us
            </Link>
            {categories && categories.length > 0 && (
              <>
                <div className="mt-3 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Categories
                </div>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/store/${store.slug}/category/${cat.slug}`}
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
    }).catch(() => {});
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
    <CartProvider slug={store.slug}>
      <WishlistProvider slug={store.slug}>
        <div className="min-h-screen bg-background font-sans" style={{ fontVariant: "small-caps" }}>
          {/* Marquee Banner */}
          <StorefrontMarquee />
          
          {/* Sticky Nav */}
          <nav className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
              <HamburgerMenu store={store} />
              <Link to={`/store/${store.slug}`} className="flex-shrink-0">
                {store.logo_url ? (
                  <img src={store.logo_url} alt={store.name} className="h-12 w-auto max-w-[160px] object-contain" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                    <Store className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
              </Link>
              <div className="flex-1" />
              <WishlistBadge slug={store.slug} />
              <CartBadge slug={store.slug} />
              <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
            </div>
          </nav>

          <Outlet context={store} />
        </div>
      </WishlistProvider>
    </CartProvider>
  );
}
