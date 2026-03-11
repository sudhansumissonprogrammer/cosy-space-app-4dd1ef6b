import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Palette, RotateCcw, Save, Lock, ShoppingCart, Heart, User, Menu, Star, Package, MapPin, Clock, MessageCircle, Store, ShoppingBag, Truck, Shield, Tag, Search, Share2, ChevronRight, ArrowLeft, Minus, Plus, X, ChevronLeft, Eye, Flame, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

const FONT_OPTIONS = [
  "Alegreya SC",
  "Inter",
  "Playfair Display",
  "Lora",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Oswald",
  "Raleway",
  "Merriweather",
  "DM Sans",
  "Space Grotesk",
];

const BUTTON_STYLES = [
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
  { value: "square", label: "Square" },
];

const COLOR_COMBINATIONS = [
  {
    id: "royal-gold",
    name: "Royal Gold",
    primary: "#b8873c",
    accent: "#000000",
    text: "#1a1a1a",
    background: "#f7f5f0",
    marquee: "linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a)",
  },
  {
    id: "crimson-royale",
    name: "Crimson Royale",
    primary: "#A71D31",
    accent: "#3F0D12",
    text: "#1a1a1a",
    background: "#FBE4E3",
    marquee: "linear-gradient(90deg, #A71D31, #e8616b, #A71D31)",
  },
  {
    id: "emerald-luxe",
    name: "Emerald Luxe",
    primary: "#1C7C54",
    accent: "#1B512D",
    text: "#1a1a1a",
    background: "#DEF4C6",
    marquee: "linear-gradient(90deg, #1B512D, #3db87a, #1C7C54)",
  },
  {
    id: "lilac-mist",
    name: "Lilac Mist",
    primary: "#663399",
    accent: "#2E1A47",
    text: "#1a1a1a",
    background: "#E6C7E6",
    marquee: "linear-gradient(90deg, #663399, #b088d4, #663399)",
  },
  {
    id: "ocean-teal",
    name: "Ocean Teal",
    primary: "#114C5A",
    accent: "#172B36",
    text: "#1a1a1a",
    background: "#F1F6F4",
    marquee: "linear-gradient(90deg, #114C5A, #38a89d, #114C5A)",
  },
  {
    id: "midnight-navy",
    name: "Midnight Navy",
    primary: "#17184B",
    accent: "#001F3F",
    text: "#1a1a1a",
    background: "#F0EEE9",
    marquee: "linear-gradient(90deg, #17184B, #4a5fb5, #17184B)",
  },
  {
    id: "velvet-merlot",
    name: "Velvet Merlot",
    primary: "#3F0D12",
    accent: "#A71D31",
    text: "#1a1a1a",
    background: "#F1F0CC",
    marquee: "linear-gradient(90deg, #3F0D12, #8b3a42, #A71D31)",
  },
  {
    id: "saffron-bloom",
    name: "Saffron Bloom",
    primary: "#FFC801",
    accent: "#114C5A",
    text: "#1a1a1a",
    background: "#F1F6F4",
    marquee: "linear-gradient(90deg, #FFC801, #ffe066, #FFC801)",
  },
  {
    id: "neon-demonic",
    name: "Neon Demonic",
    primary: "#e6ff2a",
    accent: "#0c4651",
    text: "#e6ff2a",
    background: "#0c4651",
    marquee: "linear-gradient(90deg, #e6ff2a, #0c4651, #e6ff2a)",
  },
  {
    id: "blaze-orange",
    name: "Blaze Orange",
    primary: "#ff4103",
    accent: "#001621",
    text: "#f0ece6",
    background: "#001621",
    marquee: "linear-gradient(90deg, #ff4103, #ff6a3d, #001621)",
  },
  {
    id: "coral-sunset",
    name: "Coral Sunset",
    primary: "#FF6B6B",
    accent: "#2D1B69",
    text: "#1a1a1a",
    background: "#FFF5F5",
    marquee: "linear-gradient(90deg, #FF6B6B, #ffb4a2, #e5989b)",
  },
  {
    id: "electric-violet",
    name: "Electric Violet",
    primary: "#8B5CF6",
    accent: "#1E1B4B",
    text: "#1a1a1a",
    background: "#F5F3FF",
    marquee: "linear-gradient(90deg, #8B5CF6, #c4b5fd, #7c3aed)",
  },
  {
    id: "aurora-gradient",
    name: "Aurora Gradient",
    primary: "#06B6D4",
    accent: "#7C3AED",
    text: "#F1F5F9",
    background: "#0F172A",
    marquee: "linear-gradient(90deg, #06B6D4, #22d3ee, #7C3AED, #06B6D4)",
  },
  {
    id: "sunset-fusion",
    name: "Sunset Fusion",
    primary: "#F97316",
    accent: "#EC4899",
    text: "#FDE8D0",
    background: "#1E1024",
    marquee: "linear-gradient(90deg, #F97316, #EC4899, #f43f5e, #F97316)",
  },
  {
    id: "mint-fresh",
    name: "Mint Fresh",
    primary: "#10B981",
    accent: "#064E3B",
    text: "#1a1a1a",
    background: "#ECFDF5",
    marquee: "linear-gradient(90deg, #10B981, #6ee7b7, #059669)",
  },
  {
    id: "app-blue-orange",
    name: "Blue & Orange",
    primary: "#3B82F6",
    accent: "#F97316",
    text: "#1e293b",
    background: "#F8FAFC",
    marquee: "linear-gradient(90deg, #3B82F6, #60a5fa, #F97316)",
  },
  {
    id: "app-purple-pink",
    name: "Purple & Pink",
    primary: "#A855F7",
    accent: "#EC4899",
    text: "#1e293b",
    background: "#FDF4FF",
    marquee: "linear-gradient(90deg, #A855F7, #d8b4fe, #EC4899)",
  },
  {
    id: "app-teal-cyan",
    name: "Teal & Cyan",
    primary: "#14B8A6",
    accent: "#06B6D4",
    text: "#1e293b",
    background: "#F0FDFA",
    marquee: "linear-gradient(90deg, #14B8A6, #5eead4, #06B6D4)",
  },
  {
    id: "app-black-neon",
    name: "Black & Neon",
    primary: "#22C55E",
    accent: "#22C55E",
    text: "#f0fdf4",
    background: "#0a0a0a",
    marquee: "linear-gradient(90deg, #22C55E, #0a0a0a, #22C55E)",
  },
  {
    id: "app-red-yellow",
    name: "Red & Yellow",
    primary: "#EF4444",
    accent: "#EAB308",
    text: "#1e293b",
    background: "#FFFBEB",
    marquee: "linear-gradient(90deg, #EF4444, #fca5a5, #EAB308)",
  },
];

interface ThemeConfig {
  primary_color: string;
  accent_color: string;
  text_color: string;
  background_color: string;
  heading_font: string;
  body_font: string;
  button_style: string;
  marquee_gradient: string;
}

const THEME_DEFAULTS: Record<string, ThemeConfig> = {
  "theme-1": {
    primary_color: "#b8873c",
    accent_color: "#000000",
    text_color: "#1a1a1a",
    background_color: "#f7f5f0",
    heading_font: "Alegreya SC",
    body_font: "Inter",
    button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a)",
  },
  "theme-2": {
    primary_color: "#b8873c",
    accent_color: "#000000",
    text_color: "#1a1a1a",
    background_color: "#f7f5f0",
    heading_font: "Space Grotesk",
    body_font: "DM Sans",
    button_style: "pill",
    marquee_gradient: "linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a)",
  },
  "theme-3": {
    primary_color: "#3B82F6",
    accent_color: "#F97316",
    text_color: "#1e293b",
    background_color: "#F8FAFC",
    heading_font: "Inter",
    body_font: "Inter",
    button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #3B82F6, #60a5fa, #F97316)",
  },
};

const THEMES = [
  { id: "theme-1", name: "Classic", description: "Elegant gold & black with serif headings", available: true },
  { id: "theme-2", name: "Bold Modern", description: "Transparent header, carousel hero, masonry grid", available: true },
  { id: "theme-3", name: "App Style", description: "Mobile-app inspired with bottom tab bar & flash deals", available: true },
];

/* ── Helper: compute lighter tint ── */
function lightenColor(hex: string, amount = 0.35): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount));
  return `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

/* ── Types for preview ── */
interface FakeProduct {
  id: number;
  name: string;
  price: string;
  priceNum: number;
  oldPrice: string | null;
  discount: string | null;
  rating: number;
  badge: string | null;
}

const FAKE_PRODUCTS: FakeProduct[] = [
  { id: 0, name: "Premium Leather Handbag", price: "₹2,499", priceNum: 2499, oldPrice: "₹3,999", discount: "38% off", rating: 4.7, badge: "Trending" },
  { id: 1, name: "Classic Tote Collection", price: "₹1,899", priceNum: 1899, oldPrice: null, discount: null, rating: 4.5, badge: null },
  { id: 2, name: "Designer Clutch Set", price: "₹1,299", priceNum: 1299, oldPrice: "₹1,999", discount: "35% off", rating: 4.8, badge: "Best Seller" },
  { id: 3, name: "Evening Sling Bag", price: "₹999", priceNum: 999, oldPrice: null, discount: null, rating: 4.3, badge: null },
];

const FAKE_CATEGORIES = ["Handbags", "Totes", "Clutches", "Slings"];

type PreviewScreen = "home" | "product" | "cart";

/* ── Full Storefront Preview Component ── */
function FullStorefrontPreview({ config, storeName }: { config: ThemeConfig; storeName: string }) {
  const primaryLight = lightenColor(config.primary_color);
  const btnText = isLightColor(config.primary_color) ? "#1a1a1a" : "#ffffff";
  const btnRadius = config.button_style === "pill" ? "9999px" : config.button_style === "square" ? "0px" : "0.5rem";

  const [screen, setScreen] = useState<PreviewScreen>("home");
  const [selectedProduct, setSelectedProduct] = useState<FakeProduct | null>(null);
  const [cartItems, setCartItems] = useState<{ product: FakeProduct; qty: number }[]>([]);
  const [showCart, setShowCart] = useState(false);

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.product.priceNum * i.qty, 0);

  const addToCart = useCallback((product: FakeProduct) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
    setShowCart(true);
  }, []);

  const openProduct = (product: FakeProduct) => {
    setSelectedProduct(product);
    setScreen("product");
  };

  const goHome = () => {
    setScreen("home");
    setSelectedProduct(null);
  };

  /* ── Shared Navbar ── */
  const Navbar = ({ showBack = false }: { showBack?: boolean }) => (
    <div className="sticky top-0 z-10 border-b px-3 py-2 flex items-center gap-2" style={{ backgroundColor: config.background_color + "f5", backdropFilter: "blur(8px)" }}>
      {showBack ? (
        <button onClick={goHome} className="flex items-center justify-center h-7 w-7 rounded-lg" style={{ color: config.text_color }}>
          <ArrowLeft className="h-4 w-4" />
        </button>
      ) : (
        <Menu className="h-4 w-4" style={{ color: config.text_color }} />
      )}
      <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: config.primary_color }}>
        <Store className="h-3 w-3" style={{ color: btnText }} />
      </div>
      <span className="text-xs font-bold truncate" style={{ color: config.text_color, fontFamily: config.heading_font }}>{storeName}</span>
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        <Heart className="h-3.5 w-3.5" style={{ color: config.text_color + "99" }} />
        <button onClick={() => setShowCart(true)} className="relative">
          <ShoppingCart className="h-3.5 w-3.5" style={{ color: config.text_color }} />
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full text-[6px] font-bold" style={{ backgroundColor: config.primary_color, color: btnText }}>{cartCount}</span>
          )}
        </button>
      </div>
    </div>
  );

  /* ── Home Screen ── */
  const HomeScreen = () => (
    <>
      {/* Search */}
      <div className="border-b px-3 py-1.5" style={{ backgroundColor: config.background_color }}>
        <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: config.text_color + "20" }}>
          <Search className="h-3 w-3" style={{ color: config.text_color + "60" }} />
          <span className="text-[10px]" style={{ color: config.text_color + "50", fontFamily: config.heading_font }}>Search products...</span>
        </div>
      </div>

      {/* Categories */}
      <div className="border-b px-3 py-2.5 flex gap-3 overflow-hidden" style={{ backgroundColor: config.background_color }}>
        {FAKE_CATEGORIES.map((cat) => (
          <div key={cat} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="h-9 w-9 rounded-full border-2 flex items-center justify-center" style={{ borderColor: config.primary_color + "50", backgroundColor: config.primary_color + "10" }}>
              <Tag className="h-3.5 w-3.5" style={{ color: config.primary_color }} />
            </div>
            <span className="text-[7px] font-semibold" style={{ color: config.text_color, fontFamily: config.heading_font }}>{cat}</span>
          </div>
        ))}
      </div>

      {/* Hero */}
      <div className="mx-3 mt-2.5 rounded-xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${config.primary_color}22, ${config.accent_color}22)` }}>
        <div className="px-4 py-6 text-center">
          <h2 className="text-base font-bold" style={{ color: config.text_color, fontFamily: config.heading_font }}>New Collection</h2>
          <p className="mt-0.5 text-[10px]" style={{ color: config.text_color + "88", fontFamily: config.body_font }}>Discover our latest arrivals</p>
          <button
            className="mt-2.5 px-4 py-1.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: `linear-gradient(135deg, ${config.primary_color}, ${primaryLight}, ${config.primary_color})`, color: btnText, borderRadius: btnRadius }}
          >
            Shop Now
          </button>
        </div>
      </div>

      {/* Products */}
      <div className="px-3 py-3">
        <h3 className="mb-2 text-xs font-bold" style={{ color: config.text_color, fontFamily: config.heading_font }}>All Products</h3>
        <div className="grid grid-cols-2 gap-2">
          {FAKE_PRODUCTS.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-lg border cursor-pointer transition-transform active:scale-[0.97]"
              style={{ borderColor: config.text_color + "10", backgroundColor: config.background_color }}
              onClick={() => openProduct(product)}
            >
              <div className="relative" style={{ aspectRatio: "4/5", backgroundColor: config.primary_color + "08" }}>
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-6 w-6" style={{ color: config.text_color + "20" }} />
                </div>
                {product.badge && (
                  <span className="absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[6px] font-bold" style={{ backgroundColor: config.accent_color, color: config.background_color }}>
                    {product.badge}
                  </span>
                )}
              </div>
              <div className="px-1.5 pb-1.5 pt-1 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: config.text_color + "70" }}>TOP RATED</span>
                  <div className="flex items-center gap-0.5">
                    <Star className="h-2 w-2 fill-current" style={{ color: config.primary_color }} />
                    <span className="text-[7px] font-bold" style={{ color: config.text_color }}>{product.rating}</span>
                  </div>
                </div>
                <p className="text-[9px] font-bold leading-tight line-clamp-2" style={{ color: config.text_color, fontFamily: config.heading_font }}>{product.name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-extrabold" style={{ color: config.text_color }}>{product.price}</span>
                  {product.oldPrice && (
                    <>
                      <span className="text-[7px] line-through" style={{ color: config.text_color + "60" }}>{product.oldPrice}</span>
                      <span className="rounded-full px-1 text-[6px] font-bold" style={{ backgroundColor: config.primary_color + "15", color: config.primary_color }}>{product.discount}</span>
                    </>
                  )}
                </div>
                <button
                  className="flex h-5 w-full items-center justify-center gap-0.5 text-[7px] font-extrabold uppercase tracking-wider"
                  style={{ background: `linear-gradient(135deg, ${config.primary_color}, ${primaryLight}, ${config.primary_color})`, color: btnText, borderRadius: btnRadius }}
                  onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                >
                  <ShoppingCart className="h-2 w-2" />
                  ADD TO CART
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t" style={{ backgroundColor: config.accent_color, color: config.background_color }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded" style={{ backgroundColor: config.primary_color }}>
                <Store className="h-2.5 w-2.5" style={{ color: btnText }} />
              </div>
              <span className="text-[9px] font-bold">{storeName}</span>
            </div>
            <p className="text-[7px] opacity-60">Premium quality products.</p>
          </div>
          <div>
            <h4 className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: config.primary_color }}>Quick Links</h4>
            <div className="space-y-0.5">
              {["Home", "Contact", "Returns", "Terms"].map((link) => (
                <p key={link} className="text-[7px] opacity-60">{link}</p>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-2 border-t pt-1.5 text-center" style={{ borderColor: config.background_color + "15" }}>
          <p className="text-[6px] opacity-40">© 2026 {storeName}. All rights reserved.</p>
        </div>
      </div>
    </>
  );

  /* ── Product Detail Screen ── */
  const ProductScreen = () => {
    if (!selectedProduct) return null;
    const p = selectedProduct;
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          {/* Product Image */}
          <div className="relative" style={{ aspectRatio: "1/1", backgroundColor: config.primary_color + "08" }}>
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-12 w-12" style={{ color: config.text_color + "20" }} />
            </div>
            {p.badge && (
              <span className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[7px] font-bold" style={{ backgroundColor: config.accent_color, color: config.background_color }}>
                {p.badge}
              </span>
            )}
            <button className="absolute right-3 top-3 h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: config.background_color + "cc" }}>
              <Heart className="h-3.5 w-3.5" style={{ color: config.text_color + "80" }} />
            </button>
            {/* Dot indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-1.5 rounded-full" style={{ width: i === 0 ? "12px" : "6px", backgroundColor: i === 0 ? config.primary_color : config.text_color + "30" }} />
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="px-3 py-3 space-y-2.5">
            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-2.5 w-2.5 fill-current" style={{ color: i < Math.floor(p.rating) ? config.primary_color : config.text_color + "20" }} />
                ))}
                <span className="ml-1 text-[9px] font-bold" style={{ color: config.text_color }}>{p.rating}</span>
              </div>
              <span className="text-[8px]" style={{ color: config.text_color + "50" }}>|</span>
              <span className="text-[8px] font-semibold flex items-center gap-0.5" style={{ color: config.primary_color }}>
                <Flame className="h-2.5 w-2.5" /> 52+ sold
              </span>
            </div>

            {/* Title */}
            <h1 className="text-sm font-bold leading-snug" style={{ color: config.text_color, fontFamily: config.heading_font }}>{p.name}</h1>

            {/* Price Block */}
            <div className="rounded-lg p-2.5" style={{ background: `linear-gradient(135deg, ${config.primary_color}11, ${config.primary_color}22)`, border: `1px solid ${config.primary_color}20` }}>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-extrabold" style={{ color: config.text_color }}>{p.price}</span>
                {p.oldPrice && (
                  <>
                    <span className="text-[10px] line-through" style={{ color: config.text_color + "60" }}>{p.oldPrice}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold" style={{ backgroundColor: config.primary_color, color: btnText }}>{p.discount}</span>
                  </>
                )}
              </div>
              <p className="text-[7px] mt-0.5" style={{ color: config.text_color + "70" }}>Inclusive of all taxes</p>
            </div>

            {/* Live viewers */}
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: config.primary_color }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: config.primary_color }} />
              </span>
              <span className="text-[8px]" style={{ color: config.text_color + "80" }}>
                <Eye className="inline h-2.5 w-2.5 mr-0.5" />
                <strong style={{ color: config.text_color }}>8 people</strong> viewing now
              </span>
            </div>

            {/* Variants */}
            <div className="space-y-1.5">
              <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: config.text_color + "70" }}>Select Size</p>
              <div className="flex gap-1.5">
                {["S", "M", "L", "XL"].map((size, i) => (
                  <button
                    key={size}
                    className="h-7 w-9 rounded-lg border-2 text-[8px] font-bold transition-all"
                    style={{
                      borderColor: i === 1 ? config.primary_color : config.text_color + "20",
                      backgroundColor: i === 1 ? config.primary_color + "15" : "transparent",
                      color: config.text_color,
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div className="rounded-lg border p-2 space-y-1.5" style={{ borderColor: config.text_color + "15" }}>
              <div className="flex items-center gap-2">
                <Truck className="h-3 w-3" style={{ color: config.primary_color }} />
                <div>
                  <p className="text-[8px] font-bold" style={{ color: config.text_color }}>Free Delivery</p>
                  <p className="text-[6px]" style={{ color: config.text_color + "60" }}>Get it by Mon, Mar 16</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3" style={{ color: config.primary_color }} />
                <p className="text-[8px] font-bold" style={{ color: config.text_color }}>Secure Checkout</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky bottom CTA */}
        <div className="border-t px-3 py-2 flex gap-2" style={{ backgroundColor: config.background_color, borderColor: config.text_color + "15" }}>
          <button
            className="flex-1 h-9 flex items-center justify-center gap-1 text-[8px] font-extrabold uppercase tracking-wider"
            style={{ background: `linear-gradient(135deg, ${config.primary_color}, ${primaryLight}, ${config.primary_color})`, color: btnText, borderRadius: btnRadius }}
            onClick={() => addToCart(p)}
          >
            <ShoppingCart className="h-3 w-3" /> Add to Cart
          </button>
          <button
            className="flex-1 h-9 flex items-center justify-center gap-1 text-[8px] font-extrabold uppercase tracking-wider"
            style={{ backgroundColor: config.accent_color, color: config.background_color, borderRadius: btnRadius }}
          >
            <ShoppingBag className="h-3 w-3" /> Buy Now
          </button>
        </div>
      </div>
    );
  };

  /* ── Side Cart Overlay ── */
  const CartOverlay = () => (
    <div className="absolute inset-0 z-20 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={() => setShowCart(false)} />
      {/* Cart drawer */}
      <div className="w-[80%] flex flex-col" style={{ backgroundColor: config.background_color }}>
        {/* Header */}
        <div className="border-b px-3 py-2.5 flex items-center justify-between" style={{ borderColor: config.text_color + "15" }}>
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" style={{ color: config.text_color }} />
            <span className="text-[10px] font-bold" style={{ color: config.text_color }}>Cart ({cartCount})</span>
          </div>
          <button onClick={() => setShowCart(false)}>
            <X className="h-3.5 w-3.5" style={{ color: config.text_color + "80" }} />
          </button>
        </div>

        {/* Items */}
        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <ShoppingCart className="h-8 w-8" style={{ color: config.text_color + "20" }} />
            <p className="text-[10px] font-semibold" style={{ color: config.text_color }}>Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {cartItems.map((item) => (
                <div key={item.product.id} className="flex gap-2 rounded-lg border p-2" style={{ borderColor: config.text_color + "10" }}>
                  <div className="h-12 w-12 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: config.primary_color + "08" }}>
                    <Package className="h-4 w-4" style={{ color: config.text_color + "25" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-bold line-clamp-1" style={{ color: config.text_color, fontFamily: config.heading_font }}>{item.product.name}</p>
                    <p className="text-[9px] font-extrabold mt-0.5" style={{ color: config.text_color }}>₹{(item.product.priceNum * item.qty).toLocaleString()}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex items-center rounded border" style={{ borderColor: config.text_color + "20" }}>
                        <button
                          className="h-4 w-5 flex items-center justify-center text-[8px]"
                          onClick={() => setCartItems((prev) => prev.map((i) => i.product.id === item.product.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))}
                        >
                          <Minus className="h-2 w-2" style={{ color: config.text_color }} />
                        </button>
                        <span className="w-4 text-center text-[8px] font-bold" style={{ color: config.text_color }}>{item.qty}</span>
                        <button
                          className="h-4 w-5 flex items-center justify-center text-[8px]"
                          onClick={() => setCartItems((prev) => prev.map((i) => i.product.id === item.product.id ? { ...i, qty: i.qty + 1 } : i))}
                        >
                          <Plus className="h-2 w-2" style={{ color: config.text_color }} />
                        </button>
                      </div>
                      <button
                        className="ml-auto"
                        onClick={() => setCartItems((prev) => prev.filter((i) => i.product.id !== item.product.id))}
                      >
                        <X className="h-2.5 w-2.5" style={{ color: "#ef4444" }} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart footer */}
            <div className="border-t px-3 py-2.5 space-y-2" style={{ borderColor: config.text_color + "15" }}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-medium" style={{ color: config.text_color + "80" }}>Subtotal</span>
                <span className="text-[11px] font-bold" style={{ color: config.text_color }}>₹{cartTotal.toLocaleString()}</span>
              </div>
              <button
                className="flex h-8 w-full items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-wider"
                style={{ background: `linear-gradient(135deg, ${config.primary_color}, ${primaryLight}, ${config.primary_color})`, color: btnText, borderRadius: btnRadius }}
              >
                <ShoppingBag className="h-3 w-3" /> Proceed to Checkout
              </button>
              <button
                className="w-full text-center text-[8px] font-medium py-1"
                style={{ color: config.text_color + "80" }}
                onClick={() => setShowCart(false)}
              >
                Continue Shopping
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex justify-center">
      <div className="relative mx-auto" style={{ width: "375px" }}>
        <div className="rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 shadow-2xl overflow-hidden">
          {/* Notch */}
          <div className="relative z-10 mx-auto flex h-6 w-32 items-center justify-center rounded-b-2xl bg-gray-800">
            <div className="h-2 w-2 rounded-full bg-gray-600" />
          </div>

          {/* Screen */}
          <div className="relative" style={{ height: "680px", backgroundColor: config.background_color }}>
            {/* Main content area */}
            <div className="h-full overflow-y-auto">
              {/* Marquee */}
              <div
                className="px-3 py-1.5 text-center text-[9px] font-medium tracking-wide"
                style={{ background: config.marquee_gradient, color: config.text_color, fontVariant: "small-caps" }}
              >
                🚚 Free Delivery • 🔄 Easy Returns • 🔒 Secure Payment
              </div>

              <Navbar showBack={screen === "product"} />

              {screen === "home" && <HomeScreen />}
              {screen === "product" && <ProductScreen />}
            </div>

            {/* Cart Overlay */}
            {showCart && <CartOverlay />}
          </div>

          {/* Home indicator */}
          <div className="flex h-5 items-center justify-center bg-gray-800">
            <div className="h-1 w-24 rounded-full bg-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Bold Modern Preview (Theme 2) ── */
function BoldModernPreview({ config, storeName }: { config: ThemeConfig; storeName: string }) {
  const primaryLight = lightenColor(config.primary_color);
  const btnText = isLightColor(config.primary_color) ? "#1a1a1a" : "#ffffff";
  const btnRadius = config.button_style === "pill" ? "9999px" : config.button_style === "square" ? "0px" : "0.5rem";

  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = ["New Collection", "Best Sellers", "Premium Quality"];

  useEffect(() => {
    const timer = setInterval(() => setCurrentSlide((c) => (c + 1) % slides.length), 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex justify-center">
      <div className="relative mx-auto" style={{ width: "375px" }}>
        <div className="rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 shadow-2xl overflow-hidden">
          <div className="relative z-10 mx-auto flex h-6 w-32 items-center justify-center rounded-b-2xl bg-gray-800">
            <div className="h-2 w-2 rounded-full bg-gray-600" />
          </div>

          <div className="relative" style={{ height: "680px", backgroundColor: config.background_color }}>
            <div className="h-full overflow-y-auto">
              {/* Hero with transparent overlay header */}
              <div className="relative" style={{ height: "280px" }}>
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${config.primary_color}, ${config.accent_color})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />

                {/* Transparent Nav overlay */}
                <div className="absolute top-0 left-0 right-0 z-10 px-3 py-2.5 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
                    <Menu className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-white" style={{ fontFamily: config.heading_font }}>{storeName}</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
                      <Heart className="h-3 w-3 text-white" />
                    </div>
                    <div className="h-6 w-6 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
                      <ShoppingCart className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>

                {/* Hero content at bottom */}
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-6">
                  <h2 className="text-lg font-bold text-white leading-tight" style={{ fontFamily: config.heading_font }}>{slides[currentSlide]}</h2>
                  <p className="text-[9px] text-white/70 mt-1" style={{ fontFamily: config.body_font }}>Discover our latest arrivals</p>
                  <button className="mt-2.5 px-4 py-1.5 text-[8px] font-bold uppercase tracking-wider" style={{ backgroundColor: config.primary_color, color: btnText, borderRadius: btnRadius }}>
                    Shop Now
                  </button>
                </div>

                {/* Carousel dots */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {slides.map((_, i) => (
                    <div key={i} className="h-1 rounded-full transition-all" style={{ width: i === currentSlide ? "14px" : "4px", backgroundColor: i === currentSlide ? config.primary_color : "rgba(255,255,255,0.4)" }} />
                  ))}
                </div>
              </div>

              {/* Search bar */}
              <div className="px-3 py-2 border-b" style={{ borderColor: config.text_color + "10", backgroundColor: config.background_color }}>
                <div className="flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: config.text_color + "20" }}>
                  <Search className="h-3 w-3" style={{ color: config.text_color + "50" }} />
                  <span className="text-[9px]" style={{ color: config.text_color + "50" }}>Search products...</span>
                </div>
              </div>

              {/* Category pills */}
              <div className="px-3 py-2 flex gap-1.5 overflow-hidden">
                {FAKE_CATEGORIES.map((cat) => (
                  <span key={cat} className="rounded-full border px-2.5 py-1 text-[7px] font-medium whitespace-nowrap" style={{ borderColor: config.primary_color + "40", color: config.text_color }}>
                    {cat}
                  </span>
                ))}
              </div>

              {/* Section title */}
              <div className="px-3 pt-1 pb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold" style={{ color: config.text_color, fontFamily: config.heading_font }}>All Products</h3>
                <span className="text-[7px] font-medium" style={{ color: config.text_color + "60" }}>Sort ↕</span>
              </div>

              {/* Masonry-style grid preview */}
              <div className="px-3 pb-4">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    {FAKE_PRODUCTS.slice(0, 2).map((product, idx) => (
                      <div key={product.id} className="overflow-hidden rounded-lg border" style={{ borderColor: config.text_color + "10" }}>
                        <div className="w-full flex items-center justify-center" style={{ height: idx === 0 ? "120px" : "90px", backgroundColor: config.primary_color + "08" }}>
                          <Package className="h-6 w-6" style={{ color: config.text_color + "15" }} />
                        </div>
                        <div className="p-1.5 space-y-0.5">
                          <p className="text-[8px] font-bold line-clamp-1" style={{ color: config.text_color, fontFamily: config.heading_font }}>{product.name}</p>
                          <span className="text-[9px] font-extrabold" style={{ color: config.text_color }}>{product.price}</span>
                          <button className="w-full h-4 flex items-center justify-center text-[6px] font-bold uppercase" style={{ backgroundColor: config.primary_color, color: btnText, borderRadius: btnRadius }}>Add to Cart</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 space-y-2 pt-4">
                    {FAKE_PRODUCTS.slice(2, 4).map((product, idx) => (
                      <div key={product.id} className="overflow-hidden rounded-lg border" style={{ borderColor: config.text_color + "10" }}>
                        <div className="w-full flex items-center justify-center" style={{ height: idx === 0 ? "100px" : "130px", backgroundColor: config.primary_color + "08" }}>
                          <Package className="h-6 w-6" style={{ color: config.text_color + "15" }} />
                        </div>
                        <div className="p-1.5 space-y-0.5">
                          <p className="text-[8px] font-bold line-clamp-1" style={{ color: config.text_color, fontFamily: config.heading_font }}>{product.name}</p>
                          <span className="text-[9px] font-extrabold" style={{ color: config.text_color }}>{product.price}</span>
                          <button className="w-full h-4 flex items-center justify-center text-[6px] font-bold uppercase" style={{ backgroundColor: config.primary_color, color: btnText, borderRadius: btnRadius }}>Add to Cart</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-3 py-3 border-t" style={{ backgroundColor: config.accent_color, color: config.background_color }}>
                <span className="text-[9px] font-bold">{storeName}</span>
                <p className="text-[6px] opacity-40 mt-1">© 2026 {storeName}. All rights reserved.</p>
              </div>
            </div>
          </div>

          <div className="flex h-5 items-center justify-center bg-gray-800">
            <div className="h-1 w-24 rounded-full bg-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── App Style Preview (Theme 3) ── */
function AppStylePreview({ config, storeName }: { config: ThemeConfig; storeName: string }) {
  const btnText = isLightColor(config.primary_color) ? "#1a1a1a" : "#ffffff";
  const btnRadius = config.button_style === "pill" ? "9999px" : config.button_style === "square" ? "0px" : "0.75rem";

  const [currentBanner, setCurrentBanner] = useState(0);
  const banners = ["New Arrivals", "Flash Sale", "Premium Quality"];

  useEffect(() => {
    const t = setInterval(() => setCurrentBanner((c) => (c + 1) % banners.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex justify-center">
      <div className="relative mx-auto" style={{ width: "375px" }}>
        <div className="rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 shadow-2xl overflow-hidden">
          <div className="relative z-10 mx-auto flex h-6 w-32 items-center justify-center rounded-b-2xl bg-gray-800">
            <div className="h-2 w-2 rounded-full bg-gray-600" />
          </div>

          <div className="relative" style={{ height: "680px", backgroundColor: config.background_color }}>
            <div className="h-full overflow-y-auto">
              {/* Sticky App Header */}
              <div className="sticky top-0 z-10 px-3 py-2 border-b" style={{ backgroundColor: config.background_color, borderColor: config.text_color + "10" }}>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.primary_color + "15" }}>
                    <Menu className="h-3.5 w-3.5" style={{ color: config.text_color }} />
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: config.text_color + "08", border: `1px solid ${config.text_color}12` }}>
                    <Search className="h-3 w-3" style={{ color: config.text_color + "40" }} />
                    <span className="text-[8px]" style={{ color: config.text_color + "40" }}>Search products...</span>
                  </div>
                  <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.primary_color + "15" }}>
                    <ShoppingCart className="h-3.5 w-3.5" style={{ color: config.text_color }} />
                  </div>
                </div>
              </div>

              {/* Banner */}
              <div className="px-3 pt-2.5">
                <div className="relative rounded-2xl overflow-hidden" style={{ height: "110px", background: `linear-gradient(135deg, ${config.primary_color}, ${config.accent_color})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <h2 className="text-sm font-bold text-white" style={{ fontFamily: config.heading_font }}>{banners[currentBanner]}</h2>
                    <p className="text-[7px] text-white/70 mt-0.5">Shop the latest trends</p>
                  </div>
                  <div className="absolute bottom-2 right-3 flex gap-1">
                    {banners.map((_, i) => (
                      <div key={i} className="h-1 rounded-full" style={{ width: i === currentBanner ? "12px" : "4px", backgroundColor: i === currentBanner ? config.primary_color : "rgba(255,255,255,0.4)" }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Category icons */}
              <div className="px-3 py-2.5 flex gap-3">
                {FAKE_CATEGORIES.map((cat) => (
                  <div key={cat} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.primary_color + "12", border: `1px solid ${config.primary_color}20` }}>
                      <Tag className="h-4 w-4" style={{ color: config.primary_color }} />
                    </div>
                    <span className="text-[7px] font-semibold" style={{ color: config.text_color }}>{cat}</span>
                  </div>
                ))}
              </div>

              {/* Flash Deals */}
              <div className="px-3 py-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded flex items-center justify-center" style={{ backgroundColor: config.primary_color }}>
                      <Flame className="h-3 w-3" style={{ color: btnText }} />
                    </div>
                    <span className="text-[9px] font-bold" style={{ color: config.text_color, fontFamily: config.heading_font }}>Flash Deals</span>
                  </div>
                  <div className="flex gap-0.5">
                    {["05", "42", "18"].map((t, i) => (
                      <span key={i} className="flex items-center">
                        <span className="rounded px-0.5 py-px text-[6px] font-bold" style={{ backgroundColor: config.primary_color, color: btnText }}>{t}</span>
                        {i < 2 && <span className="text-[6px] mx-0.5" style={{ color: config.primary_color }}>:</span>}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5 overflow-hidden">
                  {FAKE_PRODUCTS.slice(0, 3).map((p) => (
                    <div key={p.id} className="w-20 flex-shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: config.text_color + "10" }}>
                      <div className="h-16 relative flex items-center justify-center" style={{ backgroundColor: config.primary_color + "08" }}>
                        <Package className="h-5 w-5" style={{ color: config.text_color + "15" }} />
                        {p.discount && <span className="absolute top-1 left-1 rounded-full px-1 py-px text-[5px] font-bold" style={{ backgroundColor: config.primary_color, color: btnText }}>{p.discount}</span>}
                      </div>
                      <div className="p-1">
                        <p className="text-[6px] font-semibold line-clamp-1" style={{ color: config.text_color }}>{p.name}</p>
                        <span className="text-[7px] font-bold" style={{ color: config.text_color }}>{p.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[9px] font-bold" style={{ color: config.text_color, fontFamily: config.heading_font }}>All Products</h3>
                  <span className="text-[6px] font-medium" style={{ color: config.text_color + "50" }}>Sort ↕</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {FAKE_PRODUCTS.map((product) => (
                    <div key={product.id} className="overflow-hidden rounded-xl border" style={{ borderColor: config.text_color + "10" }}>
                      <div className="relative" style={{ aspectRatio: "4/5", backgroundColor: config.primary_color + "08" }}>
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-6 w-6" style={{ color: config.text_color + "15" }} />
                        </div>
                        {product.badge && (
                          <span className="absolute left-1 top-1 rounded-full px-1 py-0.5 text-[5px] font-bold" style={{ backgroundColor: config.accent_color, color: "#fff" }}>
                            {product.badge}
                          </span>
                        )}
                      </div>
                      <div className="p-1.5 space-y-0.5">
                        <p className="text-[7px] font-bold line-clamp-1" style={{ color: config.text_color }}>{product.name}</p>
                        <span className="text-[8px] font-extrabold" style={{ color: config.text_color }}>{product.price}</span>
                        <button className="w-full h-4 flex items-center justify-center text-[5px] font-bold uppercase" style={{ backgroundColor: config.primary_color, color: btnText, borderRadius: btnRadius }}>Add to Cart</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Tab Bar */}
            <div className="absolute bottom-0 left-0 right-0 border-t flex items-center justify-around px-2 py-1.5" style={{ backgroundColor: config.background_color, borderColor: config.text_color + "10" }}>
              {[
                { label: "Home", active: true },
                { label: "Categories", active: false },
                { label: "Search", active: false },
                { label: "Wishlist", active: false },
                { label: "Profile", active: false },
              ].map((tab) => (
                <div key={tab.label} className="flex flex-col items-center gap-0.5 relative">
                  {tab.active && <div className="absolute -top-1.5 h-0.5 w-4 rounded-full" style={{ backgroundColor: config.primary_color }} />}
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: tab.active ? config.primary_color : config.text_color + "30" }} />
                  <span className="text-[5px] font-medium" style={{ color: tab.active ? config.primary_color : config.text_color + "40" }}>{tab.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex h-5 items-center justify-center bg-gray-800">
            <div className="h-1 w-24 rounded-full bg-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StoreThemeSettings() {
  const { storeId } = useParams<{ storeId: string }>();
  const queryClient = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["store-detail", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, theme")
        .eq("id", storeId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const { data: themeConfig, isLoading } = useQuery({
    queryKey: ["store-theme-config", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_theme_config")
        .select("*")
        .eq("store_id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const currentTheme = store?.theme || "theme-1";
  const defaults = THEME_DEFAULTS[currentTheme] || THEME_DEFAULTS["theme-1"];

  const [config, setConfig] = useState<ThemeConfig>(defaults);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (themeConfig) {
      setConfig({
        primary_color: themeConfig.primary_color,
        accent_color: themeConfig.accent_color,
        text_color: themeConfig.text_color,
        background_color: themeConfig.background_color,
        heading_font: themeConfig.heading_font,
        body_font: themeConfig.body_font,
        button_style: themeConfig.button_style,
        marquee_gradient: themeConfig.marquee_gradient,
      });
    } else {
      setConfig(defaults);
    }
    setDirty(false);
  }, [themeConfig, currentTheme]);

  const updateField = (key: keyof ThemeConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const applyThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      const { error } = await supabase
        .from("stores")
        .update({ theme: themeId })
        .eq("id", storeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-detail", storeId] });
      toast.success("Theme applied!");
    },
    onError: () => toast.error("Failed to apply theme"),
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const payload = { store_id: storeId!, ...config };
      if (themeConfig?.id) {
        const { error } = await supabase
          .from("store_theme_config")
          .update(config)
          .eq("id", themeConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_theme_config")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-theme-config", storeId] });
      setDirty(false);
      toast.success("Theme settings saved!");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const resetToDefaults = () => {
    setConfig(defaults);
    setDirty(true);
  };

  const selectedCombo = COLOR_COMBINATIONS.find(
    (c) =>
      c.primary === config.primary_color &&
      c.accent === config.accent_color &&
      c.background === config.background_color
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Theme Settings</h1>
        <p className="text-sm text-muted-foreground">Customize your storefront's look and feel</p>
      </div>

      {/* Section 1: Theme Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Choose a Theme</CardTitle>
          <CardDescription>Select a layout theme for your storefront</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((theme) => {
              const isApplied = currentTheme === theme.id;
              return (
                <div
                  key={theme.id}
                  className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                    isApplied
                      ? "border-foreground shadow-md"
                      : theme.available
                      ? "border-border hover:border-foreground/40"
                      : "border-border opacity-60"
                  }`}
                >
                  {/* Theme preview strip */}
                  <div
                    className="h-24 w-full"
                    style={{
                      background: theme.id === "theme-1"
                        ? "linear-gradient(135deg, #f7f5f0 0%, #b8873c 50%, #000000 100%)"
                        : theme.id === "theme-2"
                        ? "linear-gradient(135deg, #ffffff 0%, #2563eb 50%, #1e293b 100%)"
                        : "linear-gradient(135deg, #F8FAFC 0%, #3B82F6 50%, #F97316 100%)",
                    }}
                  />
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{theme.name}</h3>
                        <p className="text-xs text-muted-foreground">{theme.description}</p>
                      </div>
                      {isApplied ? (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" /> Applied
                        </Badge>
                      ) : theme.available ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applyThemeMutation.mutate(theme.id)}
                          disabled={applyThemeMutation.isPending}
                        >
                          Apply
                        </Button>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <Lock className="h-3 w-3" /> Soon
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Theme Customization */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Customize Theme</CardTitle>
              <CardDescription>Adjust colors, fonts, and styles for your active theme</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Color Combinations */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Color Combination</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {COLOR_COMBINATIONS.map((combo) => {
                const isSelected = selectedCombo?.id === combo.id;
                return (
                  <div
                    key={combo.id}
                    onClick={() => {
                      setConfig((prev) => ({
                        ...prev,
                        primary_color: combo.primary,
                        accent_color: combo.accent,
                        text_color: combo.text,
                        background_color: combo.background,
                        marquee_gradient: combo.marquee,
                      }));
                      setDirty(true);
                    }}
                    className={`cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-foreground shadow-md"
                        : "border-border hover:border-foreground/40"
                    }`}
                  >
                    <div className="flex h-10">
                      <div className="flex-1" style={{ backgroundColor: combo.primary }} />
                      <div className="flex-1" style={{ backgroundColor: combo.accent }} />
                      <div className="flex-1" style={{ backgroundColor: combo.background }} />
                      <div className="flex-1" style={{ backgroundColor: combo.text }} />
                    </div>
                    <div className="flex items-center justify-between p-3">
                      <span className="text-sm font-medium">{combo.name}</span>
                      {isSelected && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" /> Selected
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Fonts */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Typography</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Heading Font</Label>
                <Select value={config.heading_font} onValueChange={(v) => updateField("heading_font", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Body Font</Label>
                <Select value={config.body_font} onValueChange={(v) => updateField("body_font", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Button Style */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Style</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">Button Style</Label>
              <Select value={config.button_style} onValueChange={(v) => updateField("button_style", v)}>
                <SelectTrigger className="w-full sm:w-1/2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUTTON_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Full Storefront Preview */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Full Storefront Preview</h4>
            {currentTheme === "theme-2" ? (
              <BoldModernPreview config={config} storeName={store?.name || "My Store"} />
            ) : (
              <FullStorefrontPreview config={config} storeName={store?.name || "My Store"} />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={() => saveConfigMutation.mutate()}
              disabled={!dirty || saveConfigMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveConfigMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={resetToDefaults} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
