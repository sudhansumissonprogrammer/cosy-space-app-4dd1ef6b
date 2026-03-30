import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store, Home, Tag, Mail, Heart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { storefrontPath } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";

type StoreData = Tables<"stores">;

export default function HamburgerMenu({ store }: { store: StoreData }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const customPages = queryClient.getQueryData<any[]>(["storefront-custom-pages", store.id]) ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 p-0" aria-label="Open menu">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="7" x2="18" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="6" y1="17" x2="18" y2="17" />
          </svg>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="storefront-font w-[280px] p-0">
        <div className="flex flex-col">
          <div className="border-b bg-card p-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} width={160} height={40} className="h-10 w-auto max-w-[160px] object-contain" loading="eager" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary"><Store className="h-4 w-4 text-primary-foreground" /></div>
                <span className="text-lg font-bold text-foreground">{store.name}</span>
              </div>
            )}
          </div>
          <nav className="flex flex-col gap-1 p-4">
            <Link to={storefrontPath(store.slug)} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Home className="h-4 w-4" />Home</Link>
            <Link to={storefrontPath(store.slug, "shop")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Store className="h-4 w-4" />Shop All</Link>
            <Link to={storefrontPath(store.slug, "about")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Store className="h-4 w-4" />About Us</Link>
            <Link to={storefrontPath(store.slug, "contact")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Mail className="h-4 w-4" />Contact Us</Link>
            {customPages.map((cp: any) => (
              <Link key={cp.id} to={storefrontPath(store.slug, `page/${cp.slug}`)} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Tag className="h-4 w-4" />{cp.title}</Link>
            ))}
            <Link to={storefrontPath(store.slug, "wishlist")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><Heart className="h-4 w-4" />Wishlist</Link>
            <Link to={storefrontPath(store.slug, "account")} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"><User className="h-4 w-4" />My Account</Link>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
