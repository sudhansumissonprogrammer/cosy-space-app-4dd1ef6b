import { useState } from "react";
import { Link } from "react-router-dom";
import { Home, ShoppingBag, Info, Mail, User, ChevronRight, LayoutGrid } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
}

interface StorefrontSidebarMenuProps {
  slug: string;
  storeName: string;
  logoUrl?: string | null;
  categories?: Category[] | null;
  onClose: () => void;
  /** Optional: override text/bg colors for themed sidebars */
  variant?: "default" | "themed";
}

export default function StorefrontSidebarMenu({
  slug,
  storeName,
  logoUrl,
  categories,
  onClose,
}: StorefrontSidebarMenuProps) {
  const [activeTab, setActiveTab] = useState<"menu" | "categories">("menu");

  const menuLinks = [
    { to: storefrontPath(slug), label: "Home", icon: Home },
    { to: storefrontPath(slug, "shop"), label: "Shop", icon: ShoppingBag },
    { to: storefrontPath(slug, "about"), label: "About Us", icon: Info },
    { to: storefrontPath(slug, "contact"), label: "Contact Us", icon: Mail },
    { to: storefrontPath(slug, "account"), label: "My Account", icon: User },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Store Name */}
      <div className="border-b px-5 py-4" style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))10" }}>
        {logoUrl ? (
          <img src={logoUrl} alt={storeName} className="h-10 w-auto max-w-[160px] object-contain" />
        ) : (
          <span
            className="text-lg font-bold"
            style={{
              color: "var(--storefront-text, hsl(var(--foreground)))",
              fontFamily: "var(--storefront-heading-font, inherit)",
            }}
          >
            {storeName}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))10" }}>
        <button
          onClick={() => setActiveTab("menu")}
          className="flex-1 py-3 text-sm font-semibold tracking-wide uppercase transition-colors relative"
          style={{
            color: activeTab === "menu"
              ? "var(--storefront-primary, hsl(var(--primary)))"
              : "var(--storefront-text, hsl(var(--foreground)))80",
            fontFamily: "var(--storefront-body-font, inherit)",
          }}
        >
          Menu
          {activeTab === "menu" && (
            <span
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 rounded-full"
              style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className="flex-1 py-3 text-sm font-semibold tracking-wide uppercase transition-colors relative"
          style={{
            color: activeTab === "categories"
              ? "var(--storefront-primary, hsl(var(--primary)))"
              : "var(--storefront-text, hsl(var(--foreground)))80",
            fontFamily: "var(--storefront-body-font, inherit)",
          }}
        >
          Categories
          {activeTab === "categories" && (
            <span
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 rounded-full"
              style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}
            />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "menu" ? (
          <nav className="flex flex-col gap-0.5 p-3">
            {menuLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-colors hover:bg-accent/60"
                style={{
                  color: "var(--storefront-text, hsl(var(--foreground)))",
                  fontFamily: "var(--storefront-body-font, inherit)",
                }}
              >
                <link.icon className="h-[18px] w-[18px] opacity-60" />
                {link.label}
                <ChevronRight className="h-4 w-4 ml-auto opacity-30" />
              </Link>
            ))}
          </nav>
        ) : (
          <nav className="flex flex-col gap-0.5 p-3">
            {categories && categories.length > 0 ? (
              categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={storefrontPath(slug, `shop?category=${cat.slug}`)}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-colors hover:bg-accent/60"
                  style={{
                    color: "var(--storefront-text, hsl(var(--foreground)))",
                    fontFamily: "var(--storefront-body-font, inherit)",
                  }}
                >
                  {cat.image_url ? (
                    <img
                      src={cat.image_url}
                      alt={cat.name}
                      className="h-8 w-8 rounded-md object-cover"
                    />
                  ) : (
                    <LayoutGrid className="h-[18px] w-[18px] opacity-60" />
                  )}
                  {cat.name}
                  <ChevronRight className="h-4 w-4 ml-auto opacity-30" />
                </Link>
              ))
            ) : (
              <p
                className="px-3 py-6 text-sm text-center opacity-50"
                style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
              >
                No categories yet
              </p>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
