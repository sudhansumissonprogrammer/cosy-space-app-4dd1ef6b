import { useState, useEffect, useCallback, useRef } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Check, Palette, RotateCcw, Save, Lock, ShoppingCart, Heart, User, Menu, Star, Package, MapPin, Clock, MessageCircle, Store, ShoppingBag, Truck, Shield, Tag, Search, Share2, ChevronRight, ArrowLeft, Minus, Plus, X, ChevronLeft, Eye, Flame, SlidersHorizontal, Sparkles, ArrowRight, Monitor, Smartphone, Zap, Home, LayoutGrid, Compass, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const FONT_OPTIONS = [
  "Alegreya SC",
  "Inter",
  "Montserrat Alternates",
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


/* ── WCAG Contrast Ratio Calculator ── */
function hexToRelativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToRelativeLuminance(hex1);
  const l2 = hexToRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const COLOR_COMBINATIONS = [
  {
    id: "cyprus-sand",
    name: "Cyprus Sand",
    primary: "#004643",
    accent: "#004643",
    text: "#222222",
    background: "#F0EDE5",
    marquee: "linear-gradient(90deg, #004643, #02615C, #004643)",
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
    id: "lilac-mist",
    name: "Lilac Mist",
    primary: "#663399",
    accent: "#2E1A47",
    text: "#1a1a1a",
    background: "#F3EAF8",
    marquee: "linear-gradient(90deg, #663399, #b088d4, #663399)",
  },
  {
    id: "ocean-teal",
    name: "Ocean Teal",
    primary: "#114C5A",
    accent: "#172B36",
    text: "#1a1a1a",
    background: "#FFF3E6",
    marquee: "linear-gradient(90deg, #114C5A, #38a89d, #114C5A)",
  },
  {
    id: "velvet-merlot",
    name: "Velvet Merlot",
    primary: "#3F0D12",
    accent: "#A71D31",
    text: "#1a1a1a",
    background: "#F8F4EE",
    marquee: "linear-gradient(90deg, #3F0D12, #8b3a42, #A71D31)",
  },
  {
    id: "elegant-black-white",
    name: "Elegant Black & White",
    primary: "#000000",
    accent: "#000000",
    text: "#000000",
    background: "#ffffff",
    marquee: "linear-gradient(90deg, #000000, #333333, #000000)",
  },
  {
    id: "teal-minimal",
    name: "Teal Minimal",
    primary: "#004545",
    accent: "#006666",
    text: "#111111",
    background: "#FFFFFF",
    marquee: "linear-gradient(90deg, #004545, #006666, #004545)",
  },
  {
    id: "teal-blaze",
    name: "Teal Blaze",
    primary: "#004545",
    accent: "#FF6B35",
    text: "#0F172A",
    background: "#F8FAFA",
    marquee: "linear-gradient(90deg, #004545, #00A8A8, #FF6B35)",
  },
  {
    id: "ghost-persian",
    name: "Ghost × Persian",
    primary: "#27187E",
    accent: "#27187E",
    text: "#1a1a1a",
    background: "#F7F7FF",
    marquee: "linear-gradient(90deg, #27187E, #3D2BA0, #27187E)",
  },
  {
    id: "crimson-sand",
    name: "Crimson Sand",
    primary: "#CD0000",
    accent: "#8B0000",
    text: "#1a1a1a",
    background: "#EFEDE6",
    marquee: "linear-gradient(90deg, #CD0000, #E53030, #CD0000)",
  },
  {
    id: "plum-cream",
    name: "Plum Cream",
    primary: "#381932",
    accent: "#5C2D52",
    text: "#1a1a1a",
    background: "#FFF3E6",
    marquee: "linear-gradient(90deg, #381932, #5C2D52, #381932)",
  },
  {
    id: "systumm-green",
    name: "Systumm Green",
    primary: "#2B4C3F",
    accent: "#1B5E4B",
    text: "#1a1a1a",
    background: "#FAFAF6",
    marquee: "linear-gradient(90deg, #2B4C3F, #1B5E4B, #2B4C3F)",
  },
  {
    id: "quick-commerce-green",
    name: "Quick Commerce Green",
    primary: "#036B52",
    accent: "#FFD33D",
    text: "#1a1a1a",
    background: "#f6f7f9",
    marquee: "linear-gradient(90deg, #FFD33D, #FFC107, #FFD33D)",
  },
  {
    id: "fitness-black",
    name: "Fitness Black",
    primary: "#0F0B0A",
    accent: "#FFD33D",
    text: "#0F0B0A",
    background: "#f6f7f9",
    marquee: "linear-gradient(90deg, #0F0B0A, #2a2422, #0F0B0A)",
  },
];

/* ── Per-theme recommended color combinations (curated for best visual result) ── */
const THEME_RECOMMENDATIONS: Record<string, string[]> = {
  "theme-1": [
    "plum-cream", "crimson-sand", "ghost-persian", "royal-gold", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "lux-black-gold", "lux-cream-brown", "velvet-merlot",
    "lux-emerald-gold", "ocean-teal", "emerald-luxe", "crimson-royale", "midnight-navy",
    "lux-white-champagne", "lilac-mist", "coral-sunset", "saffron-bloom", "mint-fresh",
  ],
  "theme-14": [
    "plum-cream", "crimson-sand", "ghost-persian", "royal-gold", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "lux-black-gold", "lux-cream-brown", "velvet-merlot",
    "lux-emerald-gold", "ocean-teal", "emerald-luxe", "crimson-royale", "midnight-navy",
    "lux-white-champagne", "lilac-mist", "coral-sunset", "saffron-bloom", "mint-fresh",
  ],
  "theme-15": [
    "plum-cream", "crimson-sand", "ghost-persian", "royal-gold", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "lux-black-gold", "lux-cream-brown", "velvet-merlot",
    "lux-emerald-gold", "ocean-teal", "emerald-luxe", "crimson-royale", "midnight-navy",
    "lux-white-champagne", "lilac-mist", "coral-sunset", "saffron-bloom", "mint-fresh",
  ],
  "theme-2": [
    "plum-cream", "crimson-sand", "ghost-persian", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "royal-gold", "lux-black-gold", "coral-sunset", "mint-fresh",
    "electric-violet", "app-blue-orange", "app-teal-cyan", "app-purple-pink", "ocean-teal",
    "crimson-royale", "emerald-luxe", "lilac-mist", "saffron-bloom", "lux-white-champagne",
  ],
  "theme-3": [
    "plum-cream", "crimson-sand", "ghost-persian", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "app-blue-orange", "app-teal-cyan", "app-purple-pink", "coral-sunset",
    "mint-fresh", "electric-violet", "app-red-yellow", "royal-gold", "lux-cream-brown",
    "crimson-royale", "emerald-luxe", "ocean-teal", "lilac-mist", "lux-black-gold",
  ],
  "theme-10": [
    "plum-cream", "crimson-sand", "ghost-persian", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "coral-sunset", "crimson-royale", "app-purple-pink", "electric-violet",
    "lilac-mist", "app-blue-orange", "mint-fresh", "app-teal-cyan", "royal-gold",
    "lux-black-gold", "lux-cream-brown", "ocean-teal", "emerald-luxe", "saffron-bloom",
  ],
  "theme-11": [
    "plum-cream", "crimson-sand", "ghost-persian", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "app-blue-orange", "app-teal-cyan", "app-purple-pink", "coral-sunset",
    "mint-fresh", "electric-violet", "royal-gold", "lux-black-gold", "lux-cream-brown",
    "ocean-teal", "emerald-luxe", "crimson-royale", "lilac-mist", "saffron-bloom",
  ],
  "theme-12": [
    "plum-cream", "crimson-sand", "ghost-persian", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "coral-sunset", "crimson-royale", "app-purple-pink", "electric-violet",
    "lilac-mist", "app-blue-orange", "mint-fresh", "app-teal-cyan", "royal-gold",
    "lux-black-gold", "lux-cream-brown", "ocean-teal", "emerald-luxe", "saffron-bloom",
  ],
  "theme-13": [
    "plum-cream", "crimson-sand", "ghost-persian", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "coral-sunset", "crimson-royale", "app-purple-pink", "electric-violet",
    "lilac-mist", "app-blue-orange", "mint-fresh", "app-teal-cyan", "royal-gold",
    "lux-black-gold", "lux-cream-brown", "ocean-teal", "emerald-luxe", "saffron-bloom",
  ],
  "theme-16": [
    "plum-cream", "crimson-sand", "ghost-persian", "royal-gold", "elegant-black-white", "teal-elegance", "teal-conversion", "teal-minimal", "teal-blaze",
    "lux-black-gold", "lux-cream-brown", "velvet-merlot",
    "lux-emerald-gold", "ocean-teal", "emerald-luxe", "crimson-royale", "midnight-navy",
    "lux-white-champagne", "lilac-mist", "coral-sunset", "saffron-bloom", "mint-fresh",
  ],
  "theme-17": [
    "systumm-green", "elegant-black-white", "lux-black-gold", "emerald-luxe", "midnight-navy", "velvet-merlot",
    "crimson-royale", "ghost-persian", "teal-elegance", "plum-cream", "ocean-teal",
  ],
  "theme-18": [
    "elegant-black-white", "lux-black-gold", "midnight-navy", "velvet-merlot", "crimson-royale",
    "ghost-persian", "emerald-luxe", "plum-cream", "ocean-teal", "teal-elegance",
  ],
  "theme-19": [
    "quick-commerce-green", "fitness-black",
  ],
  "theme-20": [
    "quick-commerce-green", "fitness-black",
  ],
};

/* ── Get sorted color combinations for a given theme ── */
function getSortedCombinations(themeId: string) {
  const recommended = THEME_RECOMMENDATIONS[themeId] || [];
  // Theme-19 / Theme-20 use a strictly curated palette — only show recommended combos
  if (themeId === "theme-19" || themeId === "theme-20") {
    return COLOR_COMBINATIONS
      .filter((c) => recommended.includes(c.id))
      .map((c) => ({ ...c, isRecommended: true, score: 0, textBgContrast: 0, primaryBgContrast: 0 }));
  }
  const recommendedSet = new Set(recommended);
  const scored = COLOR_COMBINATIONS.map((combo) => {
    const textBgContrast = contrastRatio(combo.text, combo.background);
    const primaryBgContrast = contrastRatio(combo.primary, combo.background);
    const isRecommended = recommendedSet.has(combo.id);
    // Score: recommended gets huge boost, then contrast quality
    const score = (isRecommended ? 1000 : 0) + textBgContrast * 10 + primaryBgContrast * 5;
    return { ...combo, isRecommended, score, textBgContrast, primaryBgContrast };
  });
  // Sort: recommended first (in original order), then non-recommended by score
  const rec = scored.filter((c) => c.isRecommended);
  const rest = scored.filter((c) => !c.isRecommended).sort((a, b) => b.score - a.score);
  return [...rec, ...rest];
}

interface ThemeConfig {
  primary_color: string;
  accent_color: string;
  text_color: string;
  background_color: string;
  heading_font: string;
  body_font: string;
  button_style: string;
  marquee_gradient: string;
  marquee_text: string;
  marquee_enabled: boolean;
  product_card_style: string;
  category_style: string;
  header_logo_alignment: string;
  mobile_nav_enabled: boolean;
  mobile_nav_style: string;
  header_style: string;
  bilingual_cta?: boolean;
}

const DEFAULT_MARQUEE_TEXT = "🚚 Free Delivery • 🔄 Easy Returns • 🔒 Secure Payments • 💰 Cash On Delivery • 👜 Premium Quality";

const THEME_DEFAULTS: Record<string, ThemeConfig> = {
  "theme-1": {
    primary_color: "#000000", accent_color: "#000000", text_color: "#000000", background_color: "#ffffff",
    heading_font: "Alegreya SC", body_font: "Inter", button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #000000, #333333, #000000)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-1", category_style: "style-1", header_logo_alignment: "left", mobile_nav_enabled: true, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-2": {
    primary_color: "#004643", accent_color: "#004643", text_color: "#222222", background_color: "#F0EDE5",
    heading_font: "Space Grotesk", body_font: "DM Sans", button_style: "pill",
    marquee_gradient: "linear-gradient(90deg, #004643, #02615C, #004643)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-1", category_style: "style-1", header_logo_alignment: "left", mobile_nav_enabled: false, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-3": {
    primary_color: "#3B82F6", accent_color: "#F97316", text_color: "#1e293b", background_color: "#F8FAFC",
    heading_font: "Inter", body_font: "Inter", button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #3B82F6, #60a5fa, #F97316)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-1", category_style: "style-1", header_logo_alignment: "left", mobile_nav_enabled: false, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-10": {
    primary_color: "#FF3F6C", accent_color: "#111111", text_color: "#1a1a1a", background_color: "#FFFFFF",
    heading_font: "Poppins", body_font: "Inter", button_style: "pill",
    marquee_gradient: "linear-gradient(90deg, #FF3F6C, #ff8fa3, #FF3F6C)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-1", category_style: "style-1", header_logo_alignment: "left", mobile_nav_enabled: false, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-11": {
    primary_color: "#1a1a1a", accent_color: "#EF4444", text_color: "#1a1a1a", background_color: "#F5F5F5",
    heading_font: "DM Sans", body_font: "Inter", button_style: "pill",
    marquee_gradient: "linear-gradient(90deg, #1a1a1a, #555, #1a1a1a)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-1", category_style: "style-1", header_logo_alignment: "left", mobile_nav_enabled: false, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-12": {
    primary_color: "#FF3F6C", accent_color: "#111111", text_color: "#1a1a1a", background_color: "#FFFFFF",
    heading_font: "Poppins", body_font: "Inter", button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #FF3F6C, #ff8fa3, #FF3F6C)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-3", category_style: "style-1", header_logo_alignment: "left", mobile_nav_enabled: false, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-13": {
    primary_color: "#25D366", accent_color: "#128C7E", text_color: "#1a1a1a", background_color: "#FFFFFF",
    heading_font: "DM Sans", body_font: "Inter", button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #25D366, #128C7E, #25D366)",
    marquee_text: "🍽️ Scan & Order • 📱 WhatsApp Ordering • 🚀 Quick Service • ✨ Fresh & Delicious",
    marquee_enabled: true, product_card_style: "style-4", category_style: "style-5", header_logo_alignment: "left", mobile_nav_enabled: false, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-14": {
    primary_color: "#A71D31", accent_color: "#3F0D12", text_color: "#1a1a1a", background_color: "#FBE4E3",
    heading_font: "Alegreya SC", body_font: "Inter", button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #A71D31, #e8616b, #A71D31)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-2", category_style: "style-4", header_logo_alignment: "center", mobile_nav_enabled: true, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-15": {
    primary_color: "#004643", accent_color: "#004643", text_color: "#222222", background_color: "#F0EDE5",
    heading_font: "Alegreya SC", body_font: "Inter", button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #004643, #02615C, #004643)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-1", category_style: "style-4", header_logo_alignment: "center", mobile_nav_enabled: true, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-16": {
    primary_color: "#000000", accent_color: "#000000", text_color: "#000000", background_color: "#ffffff",
    heading_font: "Alegreya SC", body_font: "Inter", button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #000000, #333333, #000000)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-1", category_style: "style-1", header_logo_alignment: "left", mobile_nav_enabled: true, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-17": {
    primary_color: "#1B3A2D", accent_color: "#1B3A2D", text_color: "#1a1a1a", background_color: "#ffffff",
    heading_font: "Space Grotesk", body_font: "Inter", button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #1B3A2D, #2d5a45, #1B3A2D)",
    marquee_text: "Limited Drop — No Restocks  ·  Premium Fabric  ·  Exclusive Picks",
    marquee_enabled: true, product_card_style: "style-1", category_style: "style-1", header_logo_alignment: "center", mobile_nav_enabled: true, mobile_nav_style: "modern", header_style: "normal",
  },
  "theme-18": {
    primary_color: "#ffffff", accent_color: "#ffffff", text_color: "#f5f5f5", background_color: "#0a0a0a",
    heading_font: "Space Grotesk", body_font: "Inter", button_style: "square",
    marquee_gradient: "linear-gradient(90deg, #ffffff, #999999, #ffffff)",
    marquee_text: DEFAULT_MARQUEE_TEXT,
    marquee_enabled: false, product_card_style: "style-5", category_style: "style-1", header_logo_alignment: "center", mobile_nav_enabled: true, mobile_nav_style: "modern", header_style: "transparent",
  },
  "theme-19": {
    primary_color: "#0F0B0A", accent_color: "#FFD33D", text_color: "#1a1a1a", background_color: "#f6f7f9",
    heading_font: "Poppins", body_font: "Inter", button_style: "pill",
    marquee_gradient: "linear-gradient(90deg, #FFD33D, #FFC107, #FFD33D)",
    marquee_text: "Free delivery on all orders! • Fresh & quick • Pay on delivery",
    marquee_enabled: true, product_card_style: "style-1", category_style: "style-4", header_logo_alignment: "left", mobile_nav_enabled: true, mobile_nav_style: "classic", header_style: "normal",
  },
  "theme-20": {
    primary_color: "#036B52", accent_color: "#FFD33D", text_color: "#1a1a1a", background_color: "#f6f7f9",
    heading_font: "Poppins", body_font: "Inter", button_style: "pill",
    marquee_gradient: "linear-gradient(90deg, #FFD33D, #FFC107, #FFD33D)",
    marquee_text: "Free delivery on all orders! • Shop everything • Pay on delivery",
    marquee_enabled: true, product_card_style: "style-1", category_style: "style-4", header_logo_alignment: "left", mobile_nav_enabled: true, mobile_nav_style: "classic", header_style: "normal",
  },
};

const THEMES = [
  { id: "theme-1", name: "Classic", description: "Elegant gold & black with serif headings", available: true },
  { id: "theme-14", name: "Classic Center", description: "Classic theme with centered logo & marquee under hero", available: true },
  { id: "theme-15", name: "Classic Center Alt", description: "Classic Center with Style-1 product cards & square category carousel", available: true },
  { id: "theme-2", name: "Bold Modern", description: "Transparent header, carousel hero, masonry grid", available: true },
  { id: "theme-3", name: "App Style", description: "Mobile-app inspired with bottom tab bar & flash deals", available: true },
  
  { id: "theme-10", name: "Fashion Runway", description: "Myntra-style fashion shopping with editorial collections", available: true },
  { id: "theme-11", name: "Shopping App", description: "Minimal nav with separated cart emphasis for faster conversions", available: true },
  { id: "theme-12", name: "Starter Classic", description: "Clean classic storefront with hero, carousel & product grid", available: true },
  { id: "theme-13", name: "Restaurant QR Menu", description: "WhatsApp-first QR ordering for restaurants & cafés — no checkout, just scan & order", available: true },
  { id: "theme-16", name: "Classic + Quick Buy", description: "Classic theme with phone-first Buy Now flow — collects number & auto-fills address", available: true },
  { id: "theme-17", name: "Streetwear", description: "Dark green streetwear aesthetic with centered logo & trust ticker", available: true },
  { id: "theme-18", name: "Dark Streetwear", description: "All-black editorial layout with edge-to-edge product grids", available: true },
  { id: "theme-19", name: "Quick Commerce Grocery", description: "Blinkit-style green header, yellow category tiles, ADD-to-stepper cards — built for grocery & quick delivery", available: true },
  { id: "theme-20", name: "Multi Purpose", description: "Versatile Blinkit-style layout adaptable for any category — green header, category tiles, ADD-to-stepper cards", available: true },
];

/* ── Helper: compute lighter tint ── */

export default function StoreThemeSettings() {
  const { storeId } = useStoreSlugParam();
  const queryClient = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["store-detail", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, theme, slug")
        .eq("id", storeId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const { data: themeConfig, isLoading } = useQuery({
    queryKey: ["store-theme-config", storeId],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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

  // Fetch real products for preview
  const { data: storeProducts } = useQuery({
    queryKey: ["store-products-preview", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, sale_price, image_url, is_best_selling, category")
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch real categories for preview
  const { data: storeCategories } = useQuery({
    queryKey: ["store-categories-preview", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, image_url")
        .eq("store_id", storeId!)
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  const previewProducts = storeProducts && storeProducts.length > 0
    ? mapDbProductsToPreview(storeProducts)
    : DEFAULT_PRODUCTS;

  const previewCategories = storeCategories && storeCategories.length > 0
    ? mapDbCategoriesToPreview(storeCategories)
    : DEFAULT_CATEGORIES;

  // Local override ensures instant UI tick update when Apply is clicked,
  // even if the query cache refetch hasn't completed yet.
  const [themeOverride, setThemeOverride] = useState<string | null>(null);
  const currentTheme = themeOverride || store?.theme || "theme-1";

  // Sync override back to null once query cache catches up
  useEffect(() => {
    if (store?.theme && themeOverride && store.theme === themeOverride) {
      setThemeOverride(null);
    }
  }, [store?.theme, themeOverride]);
  const defaults = THEME_DEFAULTS[currentTheme] || THEME_DEFAULTS["theme-1"];

  const [config, setConfig] = useState<ThemeConfig>(defaults);
  const [dirty, setDirty] = useState(false);
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeDesktopRef = useRef<HTMLIFrameElement>(null);

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
        marquee_text: themeConfig.marquee_text || DEFAULT_MARQUEE_TEXT,
        marquee_enabled: themeConfig.marquee_enabled ?? true,
        product_card_style: themeConfig.product_card_style || "style-1",
        category_style: themeConfig.category_style || "style-1",
        header_logo_alignment: themeConfig.header_logo_alignment || "left",
        mobile_nav_enabled: themeConfig.mobile_nav_enabled ?? false,
        mobile_nav_style: (themeConfig as any).mobile_nav_style || "classic",
        header_style: themeConfig.header_style || "normal",
        bilingual_cta: (themeConfig as any).bilingual_cta ?? false,
      });
    } else {
      setConfig(defaults);
    }
    setDirty(false);
  }, [themeConfig, currentTheme]);

  // Send config to iframe for live preview
  const sendToIframe = useCallback((cfg: ThemeConfig) => {
    const msg = { type: "theme-preview", config: cfg };
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
    iframeDesktopRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  const setupPreviewIframe = useCallback((iframe: HTMLIFrameElement | null) => {
    iframeLoadedRef.current = true;
    sendToIframe(config);

    try {
      const doc = iframe?.contentDocument as (Document & { __themePreviewNavBound?: boolean }) | null;
      if (!doc || doc.__themePreviewNavBound) return;

      doc.__themePreviewNavBound = true;
      doc.addEventListener("click", (e: MouseEvent) => {
        const anchor = (e.target as HTMLElement | null)?.closest?.("a");
        if (!anchor) return;

        const href = anchor.getAttribute("href");
        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("javascript:") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:")
        ) {
          return;
        }

        const nextUrl = new URL(anchor.href, iframe?.contentWindow?.location.href || window.location.href);
        const isInternalStoreRoute = !!store?.slug &&
          nextUrl.origin === window.location.origin &&
          nextUrl.pathname.startsWith(`/store/${store.slug}`);

        if (isInternalStoreRoute) return;

        e.preventDefault();
        e.stopPropagation();
      }, true);
    } catch {}
  }, [config, sendToIframe, store?.slug]);

  const updateField = (key: keyof ThemeConfig, value: string | boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    setDirty(true);
    sendToIframe(newConfig);
  };

  const [iframeKey, setIframeKey] = useState(0);
  const iframeLoadedRef = useRef(false);

  const applyThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      const { error } = await supabase
        .from("stores")
        .update({ theme: themeId })
        .eq("id", storeId!);
      if (error) throw error;

      // Auto-select top recommended color combination for this theme
      const topRecommendations = THEME_RECOMMENDATIONS[themeId] || [];
      const topComboId = topRecommendations[0];
      const topCombo = topComboId
        ? COLOR_COMBINATIONS.find((c) => c.id === topComboId)
        : null;
      const themeDef = THEME_DEFAULTS[themeId] || THEME_DEFAULTS["theme-1"];

      // Preserve user's customizations for layout/style settings that are
      // independent of the theme template (category_style, mobile_nav_style, etc.)
      const preservedSettings: Partial<ThemeConfig> = themeConfig
        ? {
            category_style: themeConfig.category_style ?? config.category_style,
            mobile_nav_style: (themeConfig as any).mobile_nav_style ?? config.mobile_nav_style,
            mobile_nav_enabled: themeConfig.mobile_nav_enabled ?? config.mobile_nav_enabled,
            header_logo_alignment: themeConfig.header_logo_alignment ?? config.header_logo_alignment,
            header_style: themeConfig.header_style ?? config.header_style,
            marquee_text: themeConfig.marquee_text ?? config.marquee_text,
            marquee_enabled: themeConfig.marquee_enabled ?? config.marquee_enabled,
          }
        : {};

      const newConfig: ThemeConfig = topCombo
        ? {
            ...themeDef,
            ...preservedSettings,
            primary_color: topCombo.primary,
            accent_color: topCombo.accent,
            text_color: topCombo.text,
            background_color: topCombo.background,
            marquee_gradient: topCombo.marquee,
          }
        : { ...themeDef, ...preservedSettings };

      // Upsert the theme config so colors are persisted
      const configPayload = { store_id: storeId!, ...newConfig };
      if (themeConfig?.id) {
        await supabase
          .from("store_theme_config")
          .update(newConfig)
          .eq("id", themeConfig.id);
      } else {
        await supabase
          .from("store_theme_config")
          .insert(configPayload);
      }

      return { themeId, newConfig };
    },
    onSuccess: ({ themeId, newConfig }) => {
      // Immediately update local override so the tick moves instantly
      setThemeOverride(themeId);

      queryClient.setQueryData(["store-detail", storeId], (old: any) =>
        old ? { ...old, theme: themeId } : old
      );
      queryClient.invalidateQueries({ queryKey: ["store-detail", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store-theme-config", storeId] });
      queryClient.invalidateQueries({ queryKey: ["storefront-bulk"] });

      // Update localStorage so the iframe preview (same origin) picks up the
      // new theme instantly without waiting for a background refetch.
      if (store?.slug) {
        try {
          localStorage.setItem(`storefront_theme_${store.slug}`, themeId);
          const raw = localStorage.getItem(`storefront_data_${store.slug}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.store) {
              parsed.store.theme = themeId;
              parsed._cachedAt = Date.now();
              localStorage.setItem(`storefront_data_${store.slug}`, JSON.stringify(parsed));
            }
          }
        } catch {}
      }

      // Purge edge cache so storefront visitors see new theme immediately
      if (store?.slug) {
        import("@/lib/purgeStoreCache").then(({ purgeStoreCache }) =>
          purgeStoreCache(store.slug, (store as any).custom_domain)
        );
        import("@/lib/prewarmStore").then(({ prewarmStore }) =>
          prewarmStore(store.slug, (store as any).custom_domain)
        );
      }

      setConfig(newConfig);
      setDirty(false);
      // Soft-reload: reuse cached JS/CSS instead of destroying iframe
      setTimeout(() => {
        const activeRef = previewMode === "mobile" ? iframeRef : iframeDesktopRef;
        try {
          activeRef.current?.contentWindow?.location.reload();
        } catch {
          setIframeKey((k) => k + 1);
        }
      }, 300);
      toast.success("Theme applied with best color combination!");
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
      queryClient.invalidateQueries({ queryKey: ["storefront-bulk"] });
      setDirty(false);

      // Purge edge cache so storefront visitors see new theme immediately
      if (store?.slug) {
        import("@/lib/purgeStoreCache").then(({ purgeStoreCache }) =>
          purgeStoreCache(store.slug, (store as any).custom_domain)
        );
        import("@/lib/prewarmStore").then(({ prewarmStore }) =>
          prewarmStore(store.slug, (store as any).custom_domain)
        );
      }

      toast.success("Theme settings saved!");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const resetToDefaults = () => {
    setConfig(defaults);
    setDirty(true);
  };

  // ── Home page categories visibility (per-category toggle) ──
  const { data: allCategories = [] } = useQuery({
    queryKey: ["theme-settings-categories", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, image_url, show_on_home, display_order")
        .eq("store_id", storeId!)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Array<{ id: string; name: string; image_url: string | null; show_on_home: boolean; display_order: number }>;
    },
    enabled: !!storeId,
  });

  const toggleCategoryHome = useMutation({
    mutationFn: async ({ id, show }: { id: string; show: boolean }) => {
      const { error } = await supabase
        .from("categories")
        .update({ show_on_home: show })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, show }) => {
      await queryClient.cancelQueries({ queryKey: ["theme-settings-categories", storeId] });
      const prev = queryClient.getQueryData<any[]>(["theme-settings-categories", storeId]);
      queryClient.setQueryData<any[]>(["theme-settings-categories", storeId], (old) =>
        (old || []).map((c) => (c.id === id ? { ...c, show_on_home: show } : c))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["theme-settings-categories", storeId], ctx.prev);
      toast.error("Failed to update category");
    },
    onSuccess: (_data, variables) => {
      // Invalidate storefront caches so home page reflects change
      queryClient.invalidateQueries({ queryKey: ["storefront-categories"] });
      queryClient.invalidateQueries({ queryKey: ["storefront-categories-all", storeId] });
      queryClient.invalidateQueries({ queryKey: ["storefront-products-all-v19", storeId] });
      queryClient.invalidateQueries({ queryKey: ["storefront-bulk", store?.slug] });
      queryClient.setQueryData<any[]>(["theme-settings-categories", storeId], (old) =>
        (old || []).map((c) => (c.id === variables.id ? { ...c, show_on_home: variables.show } : c))
      );

      if (store?.slug) {
        try {
          const raw = localStorage.getItem(`storefront_data_${store.slug}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.categories)) {
              parsed.categories = parsed.categories.map((category: any) =>
                category?.id === variables.id
                  ? { ...category, show_on_home: variables.show }
                  : category
              );
              parsed._cachedAt = Date.now();
              localStorage.setItem(`storefront_data_${store.slug}`, JSON.stringify(parsed));
            }
          }
        } catch {}
      }

      if (store?.slug) {
        import("@/lib/purgeStoreCache").then(({ purgeStoreCache }) =>
          purgeStoreCache(store.slug, (store as any).custom_domain)
        );
      }

      setTimeout(() => {
        try {
          iframeRef.current?.contentWindow?.location.reload();
          iframeDesktopRef.current?.contentWindow?.location.reload();
        } catch {
          setIframeKey((k) => k + 1);
        }
      }, 150);
    },
  });
  const homeShownCount = allCategories.filter((c) => c.show_on_home !== false).length;

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
          <CardTitle className="text-lg font-extrabold tracking-tight">Pick the Website Template That You Love</CardTitle>
          <CardDescription>Select a layout theme for your storefront</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* All Themes Grid */}
          <div>
            <h4 className="text-sm font-semibold mb-3">All Themes</h4>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
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
                          ? "linear-gradient(135deg, #F0EDE5 0%, #004643 50%, #000000 100%)"
                          : theme.id === "theme-2"
                          ? "linear-gradient(135deg, #ffffff 0%, #2563eb 50%, #1e293b 100%)"
                          : theme.id === "theme-3"
                          ? "linear-gradient(135deg, #F97316 0%, #3B82F6 50%, #1e293b 100%)"
                          : theme.id === "theme-4"
                          ? "linear-gradient(135deg, #F8F5F0 0%, #C8A96A 50%, #1C1C1C 100%)"
                          : theme.id === "theme-6"
                          ? "linear-gradient(135deg, #F8FAFC 0%, #2563EB 50%, #1e293b 100%)"
                          : theme.id === "theme-7"
                          ? "linear-gradient(135deg, #ffffff 0%, #1a1a1a 50%, #000000 100%)"
                          : theme.id === "theme-8"
                          ? "linear-gradient(135deg, #F8FAFC 0%, #6C5CE7 50%, #FD79A8 100%)"
                          : theme.id === "theme-10"
                          ? "linear-gradient(135deg, #FFFFFF 0%, #FF3F6C 50%, #111111 100%)"
                          : theme.id === "theme-11"
                          ? "linear-gradient(135deg, #F5F5F5 0%, #1a1a1a 50%, #EF4444 100%)"
                          : theme.id === "theme-12"
                          ? "linear-gradient(135deg, #FFFFFF 0%, #FF3F6C 50%, #111111 100%)"
                          : theme.id === "theme-14"
                          ? "linear-gradient(135deg, #F0EDE5 0%, #004643 50%, #222222 100%)"
                          : theme.id === "theme-15"
                          ? "linear-gradient(135deg, #F0EDE5 0%, #004643 50%, #222222 100%)"
                          : theme.id === "theme-17"
                          ? "linear-gradient(135deg, #1B3A2D 0%, #2d5a45 50%, #0a0a0a 100%)"
                          : theme.id === "theme-18"
                          ? "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #333333 100%)"
                          : "linear-gradient(135deg, #F8FAFC 0%, #3B82F6 50%, #F97316 100%)",
                      }}
                    />
                    <div className="p-2.5 flex flex-col items-center text-center gap-1.5">
                      <h3 className="text-sm font-semibold leading-tight">{theme.name}</h3>
                      {isApplied ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Check className="h-3 w-3" /> Applied
                        </Badge>
                      ) : theme.available ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-4"
                          onClick={() => applyThemeMutation.mutate(theme.id)}
                          disabled={applyThemeMutation.isPending}
                        >
                          Apply
                        </Button>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" /> Soon
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
              {getSortedCombinations(currentTheme).map((combo) => {
                const isSelected = selectedCombo?.id === combo.id;
                return (
                  <div
                    key={combo.id}
                    onClick={() => {
                      const newConfig = {
                        ...config,
                        primary_color: combo.primary,
                        accent_color: combo.accent,
                        text_color: combo.text,
                        background_color: combo.background,
                        marquee_gradient: combo.marquee,
                      };
                      setConfig(newConfig);
                      setDirty(true);
                      sendToIframe(newConfig);
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
                    <div className="flex flex-col gap-0.5 p-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium truncate">{combo.name}</span>
                        {isSelected && (
                          <Badge variant="secondary" className="gap-1 flex-shrink-0 text-[10px] px-1.5 py-0.5">
                            <Check className="h-3 w-3" /> Selected
                          </Badge>
                        )}
                      </div>
                      {combo.isRecommended && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          Recommended
                        </span>
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

          {/* Header Logo Alignment — hidden for theme-19 (fixed Blinkit-style header) */}
          {currentTheme !== "theme-19" && currentTheme !== "theme-20" && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">Header Layout</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">Logo Alignment</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "left", label: "Left", desc: "Logo on the left side", icon: (
                    <div className="flex items-center gap-1 w-full">
                      <div className="h-2.5 w-6 rounded bg-foreground/80" />
                      <div className="flex-1" />
                      <div className="flex gap-0.5">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      </div>
                    </div>
                  )},
                  { value: "center", label: "Center", desc: "Logo centered in header", icon: (
                    <div className="flex items-center w-full">
                      <div className="h-2 w-2 rounded bg-muted-foreground/40" />
                      <div className="flex-1 flex justify-center">
                        <div className="h-2.5 w-6 rounded bg-foreground/80" />
                      </div>
                      <div className="flex gap-0.5">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      </div>
                    </div>
                  )},
                  { value: "left-with-search", label: "With Search", desc: "Logo left, search bar in center", icon: (
                    <div className="flex items-center gap-1 w-full">
                      <div className="h-2.5 w-4 rounded bg-foreground/80" />
                      <div className="flex-1 h-2 rounded-full bg-muted-foreground/20 border border-muted-foreground/30" />
                      <div className="flex gap-0.5">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      </div>
                    </div>
                  )},
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => updateField("header_logo_alignment", s.value)}
                    className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                      config.header_logo_alignment === s.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="w-full rounded-lg border border-border bg-card p-2">
                      {s.icon}
                    </div>
                    <span className="text-[10px] font-medium">{s.label}</span>
                    {config.header_logo_alignment === s.value && (
                      <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          {currentTheme !== "theme-19" && currentTheme !== "theme-20" && <Separator />}

          {/* Marquee Strip Text */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold">Marquee Strip</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Toggle the scrolling announcement ribbon on your storefront.
                </p>
              </div>
              <Switch
                checked={config.marquee_enabled}
                onCheckedChange={(checked) => updateField("marquee_enabled", checked)}
              />
            </div>
            {config.marquee_enabled && (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Customize the scrolling ribbon text. Use " • " to separate items.
                </p>
                <div className="space-y-2">
                  <textarea
                    value={config.marquee_text}
                    onChange={(e) => updateField("marquee_text", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
                    placeholder="🚚 Free Delivery • 🔄 Easy Returns • 🔒 Secure Payments"
                  />
                  <button
                    type="button"
                    onClick={() => updateField("marquee_text", DEFAULT_MARQUEE_TEXT)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                  >
                    Reset to default
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Bilingual CTA — Theme 16 (Classic + Quick Buy) only */}
          {currentTheme === "theme-16" && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h4 className="text-sm font-semibold">Bilingual CTA Buttons (English + Hindi)</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Show "Add to Cart / कार्ट में जोड़ें" and "Buy Now / अभी खरीदें" on product cards & product page. Designed to boost conversions for Hindi-speaking shoppers.
                    </p>
                  </div>
                  <Switch
                    checked={!!config.bilingual_cta}
                    onCheckedChange={(checked) => updateField("bilingual_cta" as any, checked)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Mobile Bottom Navigation Style */}
          {(currentTheme === "theme-1" || currentTheme === "theme-14" || currentTheme === "theme-15" || currentTheme === "theme-16" || currentTheme === "theme-18") && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-1">Mobile Bottom Navigation</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Choose the navigation bar style for mobile devices. Always visible on mobile.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "classic", label: "Classic", desc: "Standard icon + label bar" },
                    { value: "modern", label: "Modern", desc: "Floating pill with cart" },
                    ...(currentTheme === "theme-18" ? [
                      { value: "v15", label: "Minimal", desc: "Clean minimal icons" },
                    ] : []),
                    ...(["theme-1", "theme-14", "theme-15", "theme-18"].includes(currentTheme) ? [
                      { value: "v17", label: "Streetwear", desc: "Bold streetwear style" },
                    ] : []),
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => updateField("mobile_nav_style", s.value)}
                      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                        (config.mobile_nav_style || "classic") === s.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {(config.mobile_nav_style || "classic") === s.value && (
                        <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      {/* Mini preview */}
                      <div className="w-full h-8 rounded-lg border border-border bg-muted/30 flex items-center justify-around px-2">
                        {s.value === "classic" ? (
                          <>
                            <Home className="h-3 w-3 text-muted-foreground" />
                            <Store className="h-3 w-3 text-muted-foreground" />
                            <LayoutGrid className="h-3 w-3 text-muted-foreground" />
                            <Heart className="h-3 w-3 text-muted-foreground" />
                            <User className="h-3 w-3 text-muted-foreground" />
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-0.5 rounded-full bg-primary/20 px-1.5 py-0.5">
                              <Home className="h-2.5 w-2.5 text-primary" />
                              <span className="text-[7px] font-bold text-primary">Home</span>
                            </div>
                            <Store className="h-3 w-3 text-muted-foreground" />
                            <Heart className="h-3 w-3 text-muted-foreground" />
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <ShoppingCart className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold">{s.label}</span>
                      <span className="text-[9px] text-muted-foreground">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Header Style</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Choose how the header looks on your storefront.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "normal", label: "Normal", desc: "Solid background" },
                    { value: "transparent", label: "Transparent", desc: "See-through" },
                    { value: "glassmorphic", label: "Glass", desc: "Rounded blur" },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => updateField("header_style", s.value)}
                      className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                        config.header_style === s.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {config.header_style === s.value && (
                        <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <div className={`w-full h-6 rounded-md border ${
                        s.value === "normal" ? "bg-muted border-border" :
                        s.value === "transparent" ? "bg-transparent border-dashed border-muted-foreground/30" :
                        "bg-muted/40 backdrop-blur-sm border-muted-foreground/20 shadow-inner"
                      }`} />
                      <span className="text-[10px] font-semibold">{s.label}</span>
                      <span className="text-[9px] text-muted-foreground">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {currentTheme !== "theme-19" && currentTheme !== "theme-20" && <Separator />}

          {/* Product Card Style — hidden for theme-19 (uses dedicated V19ProductCard) */}
          {currentTheme !== "theme-19" && currentTheme !== "theme-20" && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">Product Card Design</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">Product Card Style</Label>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { value: "style-1", label: "Style 1", desc: "Clean minimal" },
                  { value: "style-2", label: "Style 2", desc: "Badge & overlay" },
                  { value: "style-3", label: "Style 3", desc: "Bold modern" },
                  { value: "style-4", label: "Style 4", desc: "Menu list" },
                  { value: "style-5", label: "Style 5", desc: "Dark streetwear" },
                  
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => updateField("product_card_style", s.value)}
                    className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                      config.product_card_style === s.value
                        ? "border-foreground bg-muted shadow-sm"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    {config.product_card_style === s.value && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-foreground" />
                      </div>
                    )}
                    <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs font-semibold">{s.label}</span>
                    <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          {currentTheme !== "theme-19" && currentTheme !== "theme-20" && <Separator />}

          {/* Category Style — hidden for theme-19 (uses dedicated horizontal pills) */}
          {currentTheme !== "theme-19" && currentTheme !== "theme-20" && (
          <div>
            <h4 className="mb-3 text-sm font-semibold">Category Section Design</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">Category Style</Label>
               <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {[
                  { value: "style-1", label: "Circle Carousel", icon: "○ ○ ○" },
                  { value: "style-2", label: "Square Carousel", icon: "□ □ □" },
                  { value: "style-3", label: "Grid Modern", icon: "■■■\n■■■" },
                  { value: "style-4", label: "Square Grid", icon: "□□\n□□" },
                  { value: "style-5", label: "Pill Tags", icon: "⬭ ⬭ ⬭" },
                  { value: "style-6", label: "Reveal Grid", icon: "▣▣\n↕" },
                  { value: "style-8", label: "Spotlight", icon: "◁ ◉ ▷" },
                  { value: "style-10", label: "Magazine", icon: "▬▬\n▬▬" },
                  { value: "style-11", label: "2-Row Circles", icon: "●●●\n●●●" },
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => updateField("category_style", s.value)}
                    className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                      config.category_style === s.value
                        ? "border-foreground bg-muted shadow-sm"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    {config.category_style === s.value && (
                      <div className="absolute top-1.5 right-1.5">
                        <Check className="h-3.5 w-3.5 text-foreground" />
                      </div>
                    )}
                    <span className="text-lg font-mono leading-tight whitespace-pre text-muted-foreground">{s.icon}</span>
                    <span className="text-[10px] font-semibold text-center">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          {(currentTheme === "theme-19" || currentTheme === "theme-20") && (
            <>
              <Separator />

              {/* Home Page Categories — per-category visibility toggle (Theme 19 only) */}
              <div>
                <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">Home Page Categories</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Choose which categories appear as sections on your storefront home page.
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {homeShownCount} of {allCategories.length} shown
                  </Badge>
                </div>

                {allCategories.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No categories yet. Create categories first to manage their home page visibility.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto rounded-lg border border-border p-2 bg-muted/30">
                    {allCategories.map((cat) => {
                      const isOn = cat.show_on_home !== false;
                      return (
                        <label
                          key={cat.id}
                          htmlFor={`home-cat-${cat.id}`}
                          className={`flex items-center gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${
                            isOn ? "border-foreground/20 bg-background" : "border-border bg-background/50"
                          }`}
                        >
                          <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                            {cat.image_url ? (
                              <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" />
                            ) : (
                              <Tag className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                          <Switch
                            id={`home-cat-${cat.id}`}
                            checked={isOn}
                            onCheckedChange={(checked) =>
                              toggleCategoryHome.mutate({ id: cat.id, show: checked })
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  💡 Categories with no products are automatically hidden. Toggle changes apply instantly to your live storefront.
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Full Storefront Preview */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Full Storefront Preview</h4>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-1">
                <button
                  onClick={() => setPreviewMode("mobile")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    previewMode === "mobile"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Mobile
                </button>
                <button
                  onClick={() => setPreviewMode("desktop")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    previewMode === "desktop"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Desktop
                </button>
              </div>
            </div>
            {dirty && (
              <p className="mb-3 text-xs text-muted-foreground">💡 Preview updates live. Click "Save Changes" to apply to your store.</p>
            )}
            {store?.slug ? (
              <div className="flex justify-center">
                {previewMode === "mobile" ? (
                  <div className="relative mx-auto" style={{ width: "375px" }}>
                    <div className="rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 shadow-2xl overflow-hidden">
                      <div className="relative z-10 mx-auto flex h-6 w-32 items-center justify-center rounded-b-2xl bg-gray-800">
                        <div className="h-2 w-2 rounded-full bg-gray-600" />
                      </div>
                      <div style={{ width: "363px", height: "680px", overflow: "hidden" }}>
                        <iframe
                          key={`mobile-${iframeKey}`}
                          ref={iframeRef}
                          src={`/store/${store.slug}?preview=1`}
                          title="Store Preview"
                          onLoad={() => {
                            setupPreviewIframe(iframeRef.current);
                          }}
                          style={{
                            width: "375px",
                            height: "700px",
                            border: "none",
                            transform: "scale(0.968)",
                            transformOrigin: "top left",
                          }}
                        />
                      </div>
                      <div className="flex h-5 items-center justify-center bg-gray-800">
                        <div className="h-1 w-24 rounded-full bg-gray-600" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-4xl rounded-xl border-2 border-border overflow-hidden shadow-lg">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/50 border-b border-border">
                      <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                      <div className="flex-1 mx-8 rounded-full bg-background/80 border border-border px-3 py-0.5">
                        <span className="text-[9px] text-muted-foreground">{store.slug}.shopbanao.in</span>
                      </div>
                    </div>
                    <div style={{ width: "100%", height: `${Math.round(900 * Math.min(1, 896 / 1440))}px`, overflow: "hidden" }}>
                      <iframe
                        key={`desktop-${iframeKey}`}
                        ref={iframeDesktopRef}
                        src={`/store/${store.slug}?preview=1`}
                        title="Store Preview Desktop"
                        onLoad={() => {
                          setupPreviewIframe(iframeDesktopRef.current);
                        }}
                        style={{
                          width: "1440px",
                          height: "900px",
                          border: "none",
                          transform: `scale(${Math.min(1, 896 / 1440)})`,
                          transformOrigin: "top left",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Loading preview...</p>
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
