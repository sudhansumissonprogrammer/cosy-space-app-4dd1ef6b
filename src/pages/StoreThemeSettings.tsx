import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, Palette, Lock, ShoppingCart, Heart, User, Star, Tag, Monitor, Smartphone, Home, LayoutGrid, Layers, Type, LayoutList, MoreHorizontal, Store, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import ThemeSectionNav, { ThemeSectionId, ThemeSectionMeta } from "@/components/dashboard/theme/ThemeSectionNav";
import ThemeStickySaveBar from "@/components/dashboard/theme/ThemeStickySaveBar";
import ThemeMobilePreviewDrawer from "@/components/dashboard/theme/ThemeMobilePreviewDrawer";
import ThemeCategoryStyleIcon from "@/components/dashboard/theme/ThemeCategoryStyleIcon";

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
  "theme-21": [
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
  nav_icons?: Record<string, string>;
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
  "theme-21": {
    primary_color: "#000000", accent_color: "#000000", text_color: "#000000", background_color: "#ffffff",
    heading_font: "Alegreya SC", body_font: "Inter", button_style: "rounded",
    marquee_gradient: "linear-gradient(90deg, #000000, #333333, #000000)",
    marquee_text: DEFAULT_MARQUEE_TEXT, marquee_enabled: true, product_card_style: "style-1", category_style: "style-1", header_logo_alignment: "left", mobile_nav_enabled: true, mobile_nav_style: "classic", header_style: "normal",
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
  { id: "theme-21", name: "Premium Store 1", description: "Premium classic + Quick Buy storefront — phone-first Buy Now flow & elegant layout", available: true },
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
        nav_icons: (themeConfig as any).nav_icons || {},
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

  const updateField = (key: keyof ThemeConfig, value: string | boolean | Record<string, string>) => {
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
      // NOTE: storefront-bulk invalidation removed — iframe reloads via
      // contentWindow.location.reload() below, so dashboard tree doesn't
      // need this refetched. Saves a Worker GET per theme-apply.

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
      // storefront-bulk not invalidated — iframe reload handles preview refresh.
      setDirty(false);

      // Purge edge cache so storefront visitors see new theme immediately.
      // No prewarm here — the next shopper visit warms naturally (cold-miss
      // ~150ms). Halves KV writes per theme-settings save.
      if (store?.slug) {
        import("@/lib/purgeStoreCache").then(({ purgeStoreCache }) =>
          purgeStoreCache(store.slug, (store as any).custom_domain)
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

  // ── Section meta + which sections show "configured" badge (#11) ──
  const SECTIONS: ThemeSectionMeta[] = useMemo(() => [
    { id: "template", label: "Template", icon: Layers, description: "Pick a website template" },
    { id: "colors", label: "Colors", icon: Palette, description: "Color combinations" },
    { id: "typography", label: "Typography", icon: Type, description: "Heading & body fonts" },
    { id: "layout", label: "Buttons", icon: LayoutList, description: "Button shape & corners" },
    { id: "header", label: "Header & Nav", icon: LayoutGrid, description: "Logo, header, mobile nav" },
    { id: "cards", label: "Product Cards", icon: ShoppingCart, description: "Product card design" },
    { id: "categories", label: "Categories", icon: Tag, description: "Category section style" },
    { id: "extras", label: "Extras", icon: MoreHorizontal, description: "Marquee & advanced" },
  ], []);

  const configuredMap = useMemo(() => {
    const d = defaults;
    return {
      template: true,
      colors: !!selectedCombo,
      typography: config.heading_font !== d.heading_font || config.body_font !== d.body_font,
      layout: config.button_style !== d.button_style,
      header: config.header_logo_alignment !== d.header_logo_alignment || config.header_style !== d.header_style || config.mobile_nav_style !== d.mobile_nav_style,
      cards: config.product_card_style !== d.product_card_style,
      categories: config.category_style !== d.category_style,
      extras: config.marquee_text !== d.marquee_text || !!config.bilingual_cta,
    } as Record<ThemeSectionId, boolean>;
  }, [config, defaults, selectedCombo]);

  const [activeSection, setActiveSection] = useState<ThemeSectionId>("template");

  // Custom color helpers (#9)
  const updateColor = (key: keyof ThemeConfig, hex: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
    updateField(key, hex);
  };

  // Theme thumbnail palette mapping (#4) — uses real screenshots if you add to /src/assets/themes/, falls back to gradients
  const themeGradient = (id: string) => {
    const map: Record<string, string> = {
      "theme-1": "linear-gradient(135deg, #F0EDE5 0%, #004643 50%, #000000 100%)",
      "theme-2": "linear-gradient(135deg, #ffffff 0%, #2563eb 50%, #1e293b 100%)",
      "theme-3": "linear-gradient(135deg, #F97316 0%, #3B82F6 50%, #1e293b 100%)",
      "theme-4": "linear-gradient(135deg, #F8F5F0 0%, #C8A96A 50%, #1C1C1C 100%)",
      "theme-6": "linear-gradient(135deg, #F8FAFC 0%, #2563EB 50%, #1e293b 100%)",
      "theme-7": "linear-gradient(135deg, #ffffff 0%, #1a1a1a 50%, #000000 100%)",
      "theme-8": "linear-gradient(135deg, #F8FAFC 0%, #6C5CE7 50%, #FD79A8 100%)",
      "theme-10": "linear-gradient(135deg, #FFFFFF 0%, #FF3F6C 50%, #111111 100%)",
      "theme-11": "linear-gradient(135deg, #F5F5F5 0%, #1a1a1a 50%, #EF4444 100%)",
      "theme-12": "linear-gradient(135deg, #FFFFFF 0%, #FF3F6C 50%, #111111 100%)",
      "theme-13": "linear-gradient(135deg, #25D366 0%, #128C7E 50%, #075E54 100%)",
      "theme-14": "linear-gradient(135deg, #F0EDE5 0%, #004643 50%, #222222 100%)",
      "theme-15": "linear-gradient(135deg, #F0EDE5 0%, #004643 50%, #222222 100%)",
      "theme-16": "linear-gradient(135deg, #ffffff 0%, #000000 50%, #333333 100%)",
      "theme-17": "linear-gradient(135deg, #1B3A2D 0%, #2d5a45 50%, #0a0a0a 100%)",
      "theme-18": "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #333333 100%)",
      "theme-19": "linear-gradient(135deg, #FFD33D 0%, #036B52 50%, #0F0B0A 100%)",
      "theme-20": "linear-gradient(135deg, #FFD33D 0%, #036B52 50%, #0F0B0A 100%)",
      "theme-21": "linear-gradient(135deg, #ffffff 0%, #000000 50%, #333333 100%)",
    };
    return map[id] || "linear-gradient(135deg, #F8FAFC 0%, #3B82F6 50%, #F97316 100%)";
  };

  // Build a real mini-storefront thumbnail (#4) using the theme palette
  const ThemeThumbnail = ({ themeId }: { themeId: string }) => {
    const def = THEME_DEFAULTS[themeId] || THEME_DEFAULTS["theme-1"];
    return (
      <div className="relative h-28 w-full overflow-hidden" style={{ background: def.background_color }}>
        {/* Header bar */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 py-1.5"
          style={{ background: def.primary_color }}
        >
          <div className="h-1.5 w-6 rounded-sm" style={{ background: def.background_color, opacity: 0.85 }} />
          <div className="flex gap-0.5">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: def.background_color, opacity: 0.6 }} />
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: def.background_color, opacity: 0.6 }} />
          </div>
        </div>
        {/* Hero gradient */}
        <div
          className="absolute left-2 right-2 top-7 h-7 rounded"
          style={{ background: themeGradient(themeId) }}
        />
        {/* Product grid */}
        <div className="absolute left-2 right-2 bottom-2 grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-7 rounded"
              style={{
                background: def.text_color,
                opacity: 0.12 + i * 0.05,
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  // Section renderers
  const renderTemplateSection = () => (
    <Section title="Pick a Template" hint="The base layout of your storefront. You can customize colors, fonts and more in other tabs.">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {THEMES.map((theme) => {
          const isApplied = currentTheme === theme.id;
          return (
            <div
              key={theme.id}
              className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                isApplied
                  ? "border-foreground shadow-md"
                  : theme.available
                  ? "border-border hover:border-foreground/40"
                  : "border-border opacity-60"
              }`}
            >
              <ThemeThumbnail themeId={theme.id} />
              <div className="p-2.5 flex flex-col items-center text-center gap-1.5">
                <h3 className="text-sm font-semibold leading-tight">{theme.name}</h3>
                <p className="text-[10px] leading-tight text-muted-foreground line-clamp-2 min-h-[24px]">{theme.description}</p>
                {isApplied ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Check className="h-3 w-3" /> Active
                  </Badge>
                ) : theme.available ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-xs"
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
    </Section>
  );

  const renderColorsSection = () => (
    <Section title="Color Combination" hint="Pre-tested palettes. Recommended ones look best with your active template.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {getSortedCombinations(currentTheme).map((combo) => {
          const isSelected = selectedCombo?.id === combo.id;
          return (
            <button
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
              className={`text-left overflow-hidden rounded-xl border-2 transition-all ${
                isSelected ? "border-foreground shadow-md" : "border-border hover:border-foreground/40"
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
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-foreground" />
                  )}
                </div>
                {combo.isRecommended && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    Recommended
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom color picker (#9) */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4 space-y-3">
        <div>
          <h5 className="text-sm font-semibold">Custom Colors</h5>
          <p className="text-xs text-muted-foreground mt-0.5">Fine-tune any color by hex code.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: "primary_color" as const, label: "Primary" },
            { key: "accent_color" as const, label: "Accent" },
            { key: "background_color" as const, label: "Background" },
            { key: "text_color" as const, label: "Text" },
          ].map((c) => (
            <div key={c.key} className="space-y-1">
              <Label className="text-[11px] font-medium">{c.label}</Label>
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5">
                <input
                  type="color"
                  value={config[c.key] as string}
                  onChange={(e) => updateColor(c.key, e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
                />
                <input
                  type="text"
                  value={config[c.key] as string}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v) || v === "") {
                      const next = { ...config, [c.key]: v };
                      setConfig(next);
                      if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                        setDirty(true);
                        sendToIframe(next);
                      }
                    }
                  }}
                  className="w-full bg-transparent text-xs font-mono uppercase outline-none"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );

  const renderTypographySection = () => (
    <Section title="Typography" hint="Heading font is used for titles & product names. Body font is used for descriptions & UI text.">
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
          <p className="mt-1 text-lg font-bold" style={{ fontFamily: config.heading_font }}>The Quick Brown Fox</p>
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
          <p className="mt-1 text-sm text-muted-foreground" style={{ fontFamily: config.body_font }}>Beautifully crafted for your shoppers.</p>
        </div>
      </div>
    </Section>
  );

  const renderLayoutSection = () => (
    <Section title="Button Style" hint="Affects all primary buttons (Add to cart, Buy now, etc).">
      <div className="grid grid-cols-3 gap-3">
        {BUTTON_STYLES.map((s) => (
          <button
            key={s.value}
            onClick={() => updateField("button_style", s.value)}
            className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
              config.button_style === s.value
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/30"
            }`}
          >
            {config.button_style === s.value && (
              <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </div>
            )}
            <div
              className={`flex h-7 w-full items-center justify-center bg-foreground text-background text-[10px] font-bold ${
                s.value === "rounded" ? "rounded-md" : s.value === "pill" ? "rounded-full" : "rounded-none"
              }`}
            >
              Buy Now
            </div>
            <span className="text-xs font-semibold">{s.label}</span>
          </button>
        ))}
      </div>
    </Section>
  );

  const renderHeaderSection = () => (
    <div className="space-y-6">
      {currentTheme !== "theme-19" && currentTheme !== "theme-20" && (
        <Section title="Logo Alignment" hint="Where the logo sits in your desktop header.">
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "left", label: "Left", icon: (
                <div className="flex items-center gap-1 w-full">
                  <div className="h-2.5 w-6 rounded bg-foreground/80" />
                  <div className="flex-1" />
                  <div className="flex gap-0.5">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                  </div>
                </div>
              )},
              { value: "center", label: "Center", icon: (
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
              { value: "left-with-search", label: "With Search", icon: (
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
                <div className="w-full rounded-lg border border-border bg-card p-2">{s.icon}</div>
                <span className="text-[11px] font-semibold">{s.label}</span>
                {config.header_logo_alignment === s.value && (
                  <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </Section>
      )}

      {(currentTheme === "theme-1" || currentTheme === "theme-14" || currentTheme === "theme-15" || currentTheme === "theme-16" || currentTheme === "theme-18" || currentTheme === "theme-21") && (
        <>
          <Section title="Header Style" hint="How the desktop header looks against the page.">
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
                  <span className="text-[11px] font-semibold">{s.label}</span>
                  <span className="text-[9px] text-muted-foreground">{s.desc}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Mobile Bottom Navigation" hint="The fixed bottom bar shoppers see on phones.">
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "classic", label: "Classic", desc: "Standard icon + label bar" },
                { value: "modern", label: "Modern", desc: "Floating pill with cart" },
                ...(currentTheme === "theme-18" ? [{ value: "v15", label: "Minimal", desc: "Clean minimal icons" }] : []),
                ...(["theme-1", "theme-14", "theme-15", "theme-18"].includes(currentTheme) ? [{ value: "v17", label: "Streetwear", desc: "Bold streetwear style" }] : []),
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
                  <span className="text-[11px] font-semibold">{s.label}</span>
                  <span className="text-[9px] text-muted-foreground text-center leading-tight">{s.desc}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Nav Icons" hint="Pick which icon represents each nav slot. Applies to header and the mobile bottom bar across all themes.">
            <NavIconPicker
              value={config.nav_icons || {}}
              onChange={(next) => updateField("nav_icons" as any, next as any)}
            />
          </Section>
        </>
      )}
    </div>
  );

  const renderCardsSection = () => {
    if (currentTheme === "theme-19" || currentTheme === "theme-20") {
      return (
        <Section title="Product Cards" hint="">
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            This template uses a fixed product card design optimized for grocery / quick commerce.
          </div>
        </Section>
      );
    }
    return (
      <Section title="Product Card Design" hint="How each product appears in your store grid.">
        {/* #7 — Fixed columns: 2 mobile / 3 tablet / 5 desktop (was 5-everywhere) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { value: "style-1", label: "Clean Minimal" },
            { value: "style-2", label: "Badge Overlay" },
            { value: "style-3", label: "Bold Modern" },
            { value: "style-4", label: "Menu List" },
            { value: "style-5", label: "Dark Streetwear" },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => updateField("product_card_style", s.value)}
              className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                config.product_card_style === s.value
                  ? "border-foreground bg-muted shadow-sm"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              {config.product_card_style === s.value && (
                <div className="absolute top-1.5 right-1.5">
                  <Check className="h-4 w-4 text-foreground" />
                </div>
              )}
              {/* Mini product card mockup */}
              <div className="w-full rounded-lg border border-border bg-background p-1.5">
                <div className="aspect-square rounded bg-muted mb-1.5" />
                <div className="h-1.5 w-3/4 rounded bg-foreground/40 mb-1" />
                <div className="h-1.5 w-1/2 rounded bg-foreground/20" />
              </div>
              <span className="text-[11px] font-semibold text-center">{s.label}</span>
            </button>
          ))}
        </div>
      </Section>
    );
  };

  const renderCategoriesSection = () => {
    if (currentTheme === "theme-19" || currentTheme === "theme-20") {
      return (
        <Section title="Home Page Categories" hint="Choose which categories appear on your storefront home page.">
          <div className="mb-3 flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              {homeShownCount} of {allCategories.length} shown
            </Badge>
          </div>
          {allCategories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No categories yet. Create categories first.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto rounded-lg border border-border p-2 bg-muted/30">
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
                      onCheckedChange={(checked) => toggleCategoryHome.mutate({ id: cat.id, show: checked })}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </Section>
      );
    }

    return (
      <Section title="Category Section Design" hint="How category navigation appears on your home page.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { value: "style-1", label: "Circle Carousel" },
            { value: "style-2", label: "Square Carousel" },
            { value: "style-3", label: "Grid Modern" },
            { value: "style-4", label: "Square Grid" },
            { value: "style-5", label: "Pill Tags" },
            { value: "style-6", label: "Reveal Grid" },
            { value: "style-8", label: "Spotlight" },
            { value: "style-10", label: "Magazine" },
            { value: "style-11", label: "2-Row Circles" },
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
              <ThemeCategoryStyleIcon style={s.value} />
              <span className="text-[11px] font-semibold text-center">{s.label}</span>
            </button>
          ))}
        </div>
      </Section>
    );
  };

  const renderExtrasSection = () => (
    <div className="space-y-4">
      {/* Marquee — collapsible (#13) */}
      <Accordion type="multiple" defaultValue={["marquee"]} className="space-y-2">
        <AccordionItem value="marquee" className="rounded-xl border border-border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex flex-col items-start text-left">
              <span className="text-sm font-semibold">Marquee Strip</span>
              <span className="text-xs text-muted-foreground font-normal">Scrolling announcement ribbon</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show marquee on storefront</Label>
              <Switch
                checked={config.marquee_enabled}
                onCheckedChange={(checked) => updateField("marquee_enabled", checked)}
              />
            </div>
            {config.marquee_enabled && (
              <div className="space-y-2">
                <Label className="text-xs">Marquee Text (use " • " between items)</Label>
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
            )}
          </AccordionContent>
        </AccordionItem>

        {(currentTheme === "theme-16" || currentTheme === "theme-21") && (
          <AccordionItem value="bilingual" className="rounded-xl border border-border bg-card px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-semibold">Bilingual CTA (English + Hindi)</span>
                <span className="text-xs text-muted-foreground font-normal">For Hindi-speaking shoppers</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Shows "Add to Cart / कार्ट में जोड़ें" and "Buy Now / अभी खरीदें" on product cards.
                </p>
                <Switch
                  checked={!!config.bilingual_cta}
                  onCheckedChange={(checked) => updateField("bilingual_cta" as any, checked)}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case "template": return renderTemplateSection();
      case "colors": return renderColorsSection();
      case "typography": return renderTypographySection();
      case "layout": return renderLayoutSection();
      case "header": return renderHeaderSection();
      case "cards": return renderCardsSection();
      case "categories": return renderCategoriesSection();
      case "extras": return renderExtrasSection();
    }
  };

  // ── Desktop split-screen preview iframe (#1) ──
  const desktopPreviewIframe = (
    <div className="rounded-xl border-2 border-border bg-background overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-warning/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-success/50" />
        </div>
        <div className="flex-1 mx-3 rounded-full bg-background/80 border border-border px-3 py-0.5 truncate">
          <span className="text-[10px] text-muted-foreground">{store?.slug}.shopbanao.in</span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          <button
            onClick={() => setPreviewMode("mobile")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold transition-all ${
              previewMode === "mobile" ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            <Smartphone className="h-3 w-3" />
          </button>
          <button
            onClick={() => setPreviewMode("desktop")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold transition-all ${
              previewMode === "desktop" ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            <Monitor className="h-3 w-3" />
          </button>
        </div>
      </div>
      {store?.slug && (
        <div className="bg-muted/30 flex items-center justify-center p-3">
          {previewMode === "mobile" ? (
            <div className="rounded-[1.75rem] border-[5px] border-gray-900 bg-gray-900 shadow-xl overflow-hidden">
              <div style={{ width: "300px", height: "640px", overflow: "hidden" }}>
                <iframe
                  key={`split-mobile-${iframeKey}`}
                  ref={iframeRef}
                  src={`/store/${store.slug}?preview=1`}
                  title="Mobile Preview"
                  onLoad={() => setupPreviewIframe(iframeRef.current)}
                  style={{ width: "375px", height: "800px", border: "none", transform: "scale(0.8)", transformOrigin: "top left" }}
                />
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", height: "640px", overflow: "hidden" }} className="rounded-lg border border-border bg-background">
              <iframe
                key={`split-desktop-${iframeKey}`}
                ref={iframeDesktopRef}
                src={`/store/${store.slug}?preview=1`}
                title="Desktop Preview"
                onLoad={() => setupPreviewIframe(iframeDesktopRef.current)}
                style={{ width: "1440px", height: "1280px", border: "none", transform: "scale(0.45)", transformOrigin: "top left" }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse mb-2" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="pb-24">
        {/* Page header */}
        <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Theme Settings</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Customize your storefront — changes preview live.</p>
            </div>
            {dirty && (
              <Badge variant="outline" className="hidden sm:inline-flex gap-1.5 border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Unsaved
              </Badge>
            )}
          </div>
        </div>

        {/* ── Split-screen layout (#1) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,42%)] gap-4 lg:gap-6 px-4 sm:px-6 lg:px-8">
          {/* Left: section nav */}
          <aside>
            <ThemeSectionNav
              sections={SECTIONS}
              active={activeSection}
              onSelect={setActiveSection}
              configuredMap={configuredMap}
            />
          </aside>

          {/* Center: active section content */}
          <main className="min-w-0 space-y-4">
            {renderActiveSection()}
          </main>

          {/* Right: pinned preview (desktop only) */}
          <aside className="hidden lg:block">
            <div className="sticky top-4">
              {desktopPreviewIframe}
              {dirty && (
                <p className="mt-2 text-[11px] text-center text-muted-foreground">
                  💡 Click "Save Changes" to apply to your live store.
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* Mobile sticky preview button + drawer (#2 + #10) */}
        {store?.slug && (
          <ThemeMobilePreviewDrawer
            storeSlug={store.slug}
            iframeKey={iframeKey}
            onIframeReady={setupPreviewIframe}
            registerIframe={(iframe) => {
              // Bind drawer iframe to the same refs used by theme-apply reload
              // so applying a theme on mobile actually refreshes the preview.
              (iframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = iframe;
              (iframeDesktopRef as React.MutableRefObject<HTMLIFrameElement | null>).current = iframe;
            }}
          />

        )}

        {/* Sticky save bar (#6) */}
        <ThemeStickySaveBar
          dirty={dirty}
          saving={saveConfigMutation.isPending}
          onSave={() => saveConfigMutation.mutate()}
          onReset={resetToDefaults}
        />
      </div>
    </TooltipProvider>
  );
}

/** Section card with title + optional help tooltip (#15). */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs text-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </section>
  );
}
