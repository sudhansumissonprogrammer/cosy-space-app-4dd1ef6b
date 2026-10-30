import {
  LayoutDashboard, Package, ShoppingBag, Upload, Users, UserCheck, Globe,
  Settings, CreditCard, Tag, Truck, Receipt, ShoppingCart, Palette,
  BarChart3, MessageSquare, FolderOpen, Image as ImageIcon, FileText,
  Star, Wallet, TrendingDown, Blocks, MessageCircle, Crosshair, UserCog,
} from "lucide-react";

/**
 * SINGLE SOURCE OF TRUTH for the merchant dashboard navigation.
 *
 * Previously the same menu was declared three separate times (desktop
 * sidebar, mobile full-screen menu, mobile bottom bar) which drifted apart.
 * Everything now derives from `buildDashboardNav()`.
 *
 * `description` + `keywords` exist so the menu is searchable today and so a
 * future in-dashboard AI assistant can answer "where do I do X?" by reading
 * this one file instead of guessing routes.
 */

export interface DashboardNavItem {
  /** Stable identifier, also used by the AI assistant / search. */
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  /** Match the route exactly instead of by prefix. */
  exact?: boolean;
  /** Key in dashboard_menu_config (admin can hide / mark "coming soon"). */
  menuKey?: string;
  /** Ignore menu_config gating (e.g. wallet is billing-mode driven). */
  alwaysVisible?: boolean;
  badge?: number;
  /** One-line explanation of what a merchant does here. */
  description: string;
  /** Extra search terms merchants may type. */
  keywords: string[];
  /**
   * Thin / occasional pages. Hidden behind "More" inside their group so the
   * sidebar shows only the rows a merchant uses daily. Still fully searchable.
   */
  secondary?: boolean;
}

export interface DashboardNavGroup {
  id: string;
  title: string;
  items: DashboardNavItem[];
}

interface BuildArgs {
  storeSlug?: string;
  isCommissionMode?: boolean;
  isWhatsAppOnly?: boolean;
  pendingOrders?: number;
}

export function buildDashboardNav({
  storeSlug,
  isCommissionMode = false,
  isWhatsAppOnly = false,
  pendingOrders = 0,
}: BuildArgs): DashboardNavGroup[] {
  const overview: DashboardNavGroup = {
    id: "overview",
    title: "Overview",
    items: [
      {
        id: "home",
        label: "Home",
        icon: LayoutDashboard,
        path: "/dashboard",
        exact: true,
        alwaysVisible: true,
        description: "Today's sales, pending actions and quick shortcuts.",
        keywords: ["dashboard", "home", "summary", "today", "revenue"],
      },
    ],
  };

  const account: DashboardNavGroup = {
    id: "account",
    title: "Account",
    items: [
      {
        id: "my_account",
        label: "My Account",
        icon: UserCog,
        path: "/dashboard/settings",
        exact: true,
        alwaysVisible: true,
        description: "Your login email, password and personal profile.",
        keywords: ["account", "profile", "password", "email", "login", "sign out", "my details"],
      },
    ],
  };

  if (!storeSlug) {
    return [overview, account];
  }

  const s = `/dashboard/stores/${storeSlug}`;

  const groups: DashboardNavGroup[] = [
    overview,
    {
      id: "catalog",
      title: "Catalog",
      items: [
        {
          id: "products",
          label: "Products",
          icon: Package,
          path: `${s}/products`,
          menuKey: "products",
          description: "Add, edit, price, hide or bulk-upload the items you sell.",
          keywords: ["product", "item", "add product", "price", "stock", "inventory", "bulk upload", "csv", "import"],
        },
        {
          id: "categories",
          label: "Categories",
          icon: FolderOpen,
          path: `${s}/categories`,
          menuKey: "categories",
          description: "Group products into collections shown in your storefront menu.",
          keywords: ["category", "collection", "menu", "group", "hide category"],
          secondary: true,
        },
        ...(storeSlug === "utkalwatches" ? [{
          id: "packaging", label: "Packaging", icon: Package, path: `${s}/packaging`,
          alwaysVisible: true, description: "Set category box names, photos and extra prices.",
          keywords: ["packaging", "box", "gift", "category box"],
        }] : []),
        {
          id: "best_sellers",
          label: "Best Sellers",
          icon: Star,
          path: `${s}/best-sellers`,
          menuKey: "best_sellers",
          description: "Choose which products appear in the Best Sellers row.",
          keywords: ["best seller", "trending", "featured", "top products", "carousel"],
          secondary: true,
        },
        {
          id: "reviews",
          label: "Reviews",
          icon: MessageCircle,
          path: `${s}/reviews`,
          menuKey: "reviews",
          description: "Approve, add or reply to customer product reviews and ratings.",
          keywords: ["review", "rating", "stars", "feedback", "testimonial"],
        },
        {
          id: "media_library",
          label: "Media Library",
          icon: ImageIcon,
          path: `${s}/media`,
          menuKey: "media_library",
          description: "All uploaded product photos and videos in one place.",
          keywords: ["media", "image", "photo", "video", "gallery", "upload"],
          secondary: true,
        },
        {
          id: "bulk_upload",
          label: "Bulk Upload",
          icon: Upload,
          path: `${s}/products/bulk-upload`,
          menuKey: "bulk_upload",
          description: "Import many products at once from a spreadsheet or supplier link.",
          keywords: ["bulk", "csv", "excel", "import", "mass upload", "many products"],
          secondary: true,
        },
      ],
    },
    {
      id: "orders",
      title: "Orders & Customers",
      items: [
        ...(!isWhatsAppOnly
          ? [
              {
                id: "orders_list",
                label: "Orders",
                icon: ShoppingBag,
                path: `${s}/orders`,
                menuKey: "orders",
                badge: pendingOrders,
                description: "View, confirm, ship and track every order placed on your store.",
                keywords: ["order", "sale", "ship", "awb", "tracking", "cod", "invoice", "cancel", "refund"],
              } as DashboardNavItem,
            ]
          : []),
        {
          id: "customers",
          label: "Customers",
          icon: Users,
          path: `${s}/customers`,
          menuKey: "customers",
          description: "Everyone who has ordered from you, with contact details and history.",
          keywords: ["customer", "buyer", "contact", "phone", "repeat"],
        },

        {
          id: "leads",
          label: "Leads",
          icon: UserCheck,
          path: `${s}/leads`,
          menuKey: "leads",
          description: "Enquiries and sign-ups collected from your storefront.",
          keywords: ["lead", "enquiry", "waitlist", "subscriber", "contact form"],
          secondary: true,
        },
      ],
    },
    {
      id: "payments",
      title: "Payments & Shipping",
      items: [
        {
          id: "payments",
          label: "Payments",
          icon: CreditCard,
          path: `${s}/payments`,
          menuKey: "payments",
          description: "Turn on UPI, cards, COD and partial-COD, and set prepaid discounts.",
          keywords: ["payment", "upi", "razorpay", "cashfree", "payu", "cod", "cash on delivery", "advance", "prepaid", "gateway"],
        },
        ...(isCommissionMode
          ? [
              {
                id: "wallet",
                label: "Wallet",
                icon: Wallet,
                path: `${s}/wallet`,
                menuKey: "wallet",
                alwaysVisible: true,
                description: "Your commission balance, recharges and platform-fee invoices.",
                keywords: ["wallet", "balance", "recharge", "commission", "fee", "billing", "top up"],
              } as DashboardNavItem,
            ]
          : []),


        {
          id: "shipping_rates",
          label: "Shipping Rates",
          icon: Truck,
          path: `${s}/shipping`,
          menuKey: "shipping",
          description: "Delivery charges, free-shipping threshold and delivery time estimates.",
          keywords: ["shipping", "delivery charge", "free shipping", "rate", "zone", "pincode"],
        },
        {
          id: "courier_partners",
          label: "Courier Partners",
          icon: Truck,
          path: `${s}/shipping-integrations`,
          menuKey: "shipping",
          description: "Connect Delhivery, Blue Dart, India Post and other couriers for tracking.",
          keywords: ["courier", "delhivery", "blue dart", "india post", "shiprocket", "awb", "tracking integration"],
          secondary: true,
        },
        {
          id: "tax",
          label: "Tax / GST",
          icon: Receipt,
          path: `${s}/tax`,
          menuKey: "tax_gst",
          description: "GST number, tax rates and how tax appears on invoices.",
          keywords: ["tax", "gst", "hsn", "invoice", "gstin"],
          secondary: true,
        },
      ],
    },
    {
      id: "marketing",
      title: "Marketing & Growth",
      items: [
        ...(!isWhatsAppOnly
          ? [
              {
                id: "whatsapp",
                label: "WhatsApp",
                icon: MessageSquare,
                path: `${s}/whatsapp`,
                menuKey: "whatsapp_marketing",
                description: "Automatic order, COD-confirmation and cart-recovery WhatsApp messages.",
                keywords: ["whatsapp", "message", "template", "otp", "confirmation", "campaign", "broadcast", "automation"],
              } as DashboardNavItem,
            ]
          : []),
        ...(!isWhatsAppOnly
          ? [
              {
                id: "coupons",
                label: "Coupons",
                icon: Tag,
                path: `${s}/coupons`,
                menuKey: "coupons",
                description: "Create discount codes and auto-apply offers at checkout.",
                keywords: ["coupon", "discount", "promo code", "offer", "flat", "percent", "auto apply"],
              } as DashboardNavItem,
            ]
          : []),
        {
          id: "abandoned_carts",
          label: "Abandoned Carts",
          icon: ShoppingCart,
          path: `${s}/abandoned-carts`,
          menuKey: "abandoned_carts",
          description: "Customers who left without paying — send a WhatsApp recovery nudge.",
          keywords: ["abandoned", "cart", "recovery", "left", "incomplete order", "recover"],
        },
        {
          id: "analytics",
          label: "Analytics",
          icon: BarChart3,
          path: "/dashboard/analytics",
          exact: true,
          alwaysVisible: true,
          description: "Visitors, revenue, top products and traffic sources over time.",
          keywords: ["analytics", "report", "visitors", "traffic", "revenue", "stats", "insights"],
        },

        {
          id: "funnel",
          label: "Sales Funnel",
          icon: TrendingDown,
          path: `${s}/funnel`,
          menuKey: "sales_funnel",
          description: "Where shoppers drop off between viewing, cart and payment.",
          keywords: ["funnel", "conversion", "drop off", "checkout rate"],
          secondary: true,
        },
        {
          id: "tracking",
          label: "Tracking Pixels",
          icon: Crosshair,
          path: `${s}/tracking`,
          menuKey: "tracking_analytics",
          description: "Connect Meta Pixel, Conversions API and Google Analytics for ads data.",
          keywords: ["pixel", "meta", "facebook", "capi", "google analytics", "ga4", "conversion tracking", "ads"],
        },
      ],
    },
    {
      id: "store_setup",
      title: "Store Setup",
      items: [
        {
          id: "theme",
          label: "Theme & Design",
          icon: Palette,
          path: `${s}/theme`,
          menuKey: "theme",
          description: "Pick a storefront layout and set your brand colours and fonts.",
          keywords: ["theme", "design", "colour", "color", "font", "layout", "look", "banner", "appearance"],
        },
        {
          id: "pages",
          label: "Pages & Policies",
          icon: FileText,
          path: `${s}/pages`,
          menuKey: "pages",
          description: "About Us, Contact, Return, Shipping and Privacy policy pages.",
          keywords: ["page", "about us", "contact", "policy", "return", "refund", "privacy", "terms"],
        },
        {
          id: "domain",
          label: "Domain",
          icon: Globe,
          path: `${s}/domain`,
          menuKey: "domain",
          description: "Connect your own .com / .in domain to this store.",
          keywords: ["domain", "custom domain", "dns", "url", "website address", "subdomain"],
        },
        {
          id: "apps",
          label: "App Store",
          icon: Blocks,
          path: `${s}/apps`,
          alwaysVisible: true,
          description: "Add-ons like bundles, upsells and shop-by-video.",
          keywords: ["app", "addon", "plugin", "bundle", "upsell", "extension"],
        },
        {
          id: "store_settings",
          label: "Store Settings",
          icon: Settings,
          path: `${s}/settings`,
          menuKey: "store_settings",
          description: "Store name, logo, address, SEO, notifications and Google submission.",
          keywords: ["settings", "store name", "logo", "address", "seo", "meta", "currency", "whatsapp number", "notification", "google"],
        },
      ],
    },
    account,
  ];

  return groups;
}

/** Apply admin menu_config gating and drop empty groups. */
export function filterNavGroups(
  groups: DashboardNavGroup[],
  isVisible: (key: string) => boolean,
): DashboardNavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.alwaysVisible || !i.menuKey || isVisible(i.menuKey)),
    }))
    .filter((g) => g.items.length > 0);
}

/** Flat, searchable list — also what a future AI assistant should read. */
export function searchNav(groups: DashboardNavGroup[], query: string) {
  const q = query.trim().toLowerCase();
  const flat = groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));
  if (!q) return [];
  return flat
    .filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.keywords.some((k) => k.includes(q)),
    )
    .slice(0, 8);
}
