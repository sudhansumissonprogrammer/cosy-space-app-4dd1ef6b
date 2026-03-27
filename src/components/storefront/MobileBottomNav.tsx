import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, ClipboardList, LayoutGrid, MessageCircle } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface MobileBottomNavProps {
  store: StoreData;
}

export default function MobileBottomNav({ store }: MobileBottomNavProps) {
  const location = useLocation();
  const isCheckout = location.pathname.includes("/checkout");

  // Hide on checkout
  if (isCheckout) return null;

  const phone = store.whatsapp_number?.replace(/[^0-9+]/g, "") || "";
  const waMessage = encodeURIComponent(
    `Hi ${store.name}! 👋\nI'd like to know more about your products.`
  );
  const waHref = phone ? `https://wa.me/${phone}?text=${waMessage}` : null;

  const currentPath = location.pathname;

  const isActive = (path: string) => {
    const full = storefrontPath(store.slug, path);
    return currentPath === full || currentPath.startsWith(full + "/");
  };

  const isHome = currentPath === storefrontPath(store.slug) || currentPath === storefrontPath(store.slug) + "/";

  const navItems = [
    {
      label: "Shop",
      icon: ShoppingBag,
      to: storefrontPath(store.slug),
      active: isHome,
    },
    {
      label: "Categories",
      icon: LayoutGrid,
      to: storefrontPath(store.slug, "shop"),
      active: isActive("shop") || isActive("category"),
    },
    {
      label: "Orders",
      icon: ClipboardList,
      to: storefrontPath(store.slug, "account"),
      active: isActive("account"),
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-md sm:hidden safe-bottom">
      <div className="flex items-stretch justify-around">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors"
            style={{
              color: item.active
                ? "var(--storefront-primary, hsl(var(--primary)))"
                : "hsl(var(--muted-foreground))",
            }}
          >
            <item.icon className="h-5 w-5" strokeWidth={item.active ? 2.5 : 1.8} />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        ))}

        {/* WhatsApp - external link */}
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[10px] font-medium leading-none">Chat</span>
          </a>
        ) : (
          <Link
            to={storefrontPath(store.slug, "contact")}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors"
            style={{
              color: isActive("contact")
                ? "var(--storefront-primary, hsl(var(--primary)))"
                : "hsl(var(--muted-foreground))",
            }}
          >
            <MessageCircle className="h-5 w-5" strokeWidth={isActive("contact") ? 2.5 : 1.8} />
            <span className="text-[10px] font-medium leading-none">Contact</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
